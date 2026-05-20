import React from 'react';
import { useNavigate } from 'react-router-dom';

const Flashcards = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Flashcards</h1>
        <div className="text-sm text-gray-300">Integrated with Listener & Mindmaps</div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-white/6 p-4 bg-white/3">
          <h2 className="font-medium mb-2">Quick Study</h2>
          <p className="text-sm text-gray-200">Create flashcards from Listener notes or Mindmaps.</p>
        </div>

        <div className="rounded-lg border border-white/6 p-4 bg-white/3">
          <h2 className="font-medium mb-2">MCQs</h2>
          <p className="text-sm text-gray-200">Auto-generate multiple-choice questions for recall practice.</p>
        </div>

        <div className="rounded-lg border border-white/6 p-4 bg-white/3">
          <h2 className="font-medium mb-2">SRS</h2>
          <p className="text-sm text-gray-200">Spaced repetition scheduling to boost memory retention.</p>
        </div>
      </section>
    </div>
  );
};

export default Flashcards;