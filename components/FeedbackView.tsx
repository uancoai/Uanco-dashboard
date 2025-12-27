import React from 'react';
import { Send } from 'lucide-react';

const FeedbackView = () => (
  <div className="max-w-2xl">
    <h2 className="text-3xl font-serif mb-6">Feedback</h2>

    <form
      name="clinic-feedback"
      method="POST"
      data-netlify="true"
      className="bg-white p-8 border rounded-3xl shadow-soft space-y-4"
    >
      {/* REQUIRED for Netlify form detection */}
      <input type="hidden" name="form-name" value="clinic-feedback" />

      <input
        type="text"
        name="subject"
        placeholder="Subject"
        className="w-full p-4 border rounded-xl"
        required
      />

      <textarea
        name="message"
        placeholder="Message"
        className="w-full p-4 border rounded-xl h-32"
        required
      />

      <button
        type="submit"
        className="bg-uanco-900 text-white px-8 py-4 rounded-full flex items-center gap-2"
      >
        Send <Send size={16} />
      </button>
    </form>
  </div>
);

export default FeedbackView;