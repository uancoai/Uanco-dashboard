import React from 'react';
import { Send } from 'lucide-react';

const FeedbackView = () => (
    <div className="max-w-2xl">
        <h2 className="text-3xl font-serif mb-6">Feedback</h2>
        <div className="bg-white p-8 border rounded-3xl shadow-soft space-y-4">
            <input type="text" placeholder="Subject" className="w-full p-4 border rounded-xl" />
            <textarea placeholder="Message" className="w-full p-4 border rounded-xl h-32" />
            <button className="bg-uanco-900 text-white px-8 py-4 rounded-full flex items-center gap-2">Send <Send size={16} /></button>
        </div>
    </div>
);
export default FeedbackView;