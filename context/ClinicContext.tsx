import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ClinicContextValue = {
  selectedClinicId: string;
  setSelectedClinicId: (clinicId: string) => void;
};

const ClinicContext = createContext<ClinicContextValue | undefined>(undefined);

const CLINIC_STORAGE_KEY = 'selectedClinicId';

function readClinicIdFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const sp = new URLSearchParams(window.location.search);
  return (sp.get('clinicId') || sp.get('clinicid') || '').trim();
}

function readInitialClinicId(): string {
  if (typeof window === 'undefined') return '';
  const fromUrl = readClinicIdFromUrl();
  if (fromUrl) return fromUrl;
  const fromStorage = window.localStorage.getItem(CLINIC_STORAGE_KEY) || '';
  return fromStorage.trim();
}

export const ClinicProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [selectedClinicId, setSelectedClinicIdState] = useState<string>(() => readInitialClinicId());

  useEffect(() => {
    const onPopState = () => {
      const fromUrl = readClinicIdFromUrl();
      if (fromUrl && fromUrl !== selectedClinicId) {
        setSelectedClinicIdState(fromUrl);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedClinicId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const trimmed = String(selectedClinicId || '').trim();
    if (trimmed) {
      window.localStorage.setItem(CLINIC_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(CLINIC_STORAGE_KEY);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('clinicid');
    if (trimmed) {
      url.searchParams.set('clinicId', trimmed);
    } else {
      url.searchParams.delete('clinicId');
    }

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState({}, document.title, next);
    }
  }, [selectedClinicId]);

  const setSelectedClinicId = (clinicId: string) => {
    setSelectedClinicIdState(String(clinicId || '').trim());
  };

  const value = useMemo(
    () => ({
      selectedClinicId,
      setSelectedClinicId,
    }),
    [selectedClinicId]
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
};

export function useClinicContext() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinicContext must be used within ClinicProvider');
  return ctx;
}

