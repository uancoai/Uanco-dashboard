import React, { useState } from "react";
import { Send, CheckCircle2, AlertTriangle } from "lucide-react";

const FeedbackView = () => {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const encode = (data: Record<string, string>) =>
    Object.keys(data)
      .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(data[key] ?? ""))
      .join("&");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload: Record<string, string> = {};
    formData.forEach((v, k) => (payload[k] = String(v)));

    try {
      // Netlify Forms endpoint = current page path
      await fetch(window.location.pathname || "/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(payload),
      });

      setStatus("sent");
      form.reset();
    } catch (err) {
      console.error("Feedback submit failed", err);
      setStatus("error");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-3xl font-serif">Feedback</h2>

      <div className="bg-white p-8 border rounded-3xl shadow-soft space-y-4">
        <form
          name="clinic-feedback"
          method="POST"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          onSubmit={onSubmit}
          className="space-y-4"
        >
          {/* Required for Netlify Forms */}
          <input type="hidden" name="form-name" value="clinic-feedback" />
          <p className="hidden">
            <label>
              Don’t fill this out: <input name="bot-field" />
            </label>
          </p>

          <input
            type="text"
            name="subject"
            placeholder="Subject"
            className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-uanco-200"
            required
          />

          <textarea
            name="message"
            placeholder="Message"
            className="w-full p-4 border rounded-xl h-32 outline-none focus:ring-2 focus:ring-uanco-200"
            required
          />

          <button
            type="submit"
            disabled={status === "sending"}
            className="bg-uanco-900 text-white px-8 py-4 rounded-full flex items-center gap-2 disabled:opacity-60"
          >
            <Send size={16} />
            {status === "sending" ? "Sending…" : "Send"}
          </button>

          {status === "sent" && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
              <CheckCircle2 size={16} />
              Sent — thanks!
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-2xl p-3">
              <AlertTriangle size={16} />
              Something failed — try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default FeedbackView;