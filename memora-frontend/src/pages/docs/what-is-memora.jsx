import React from 'react';

export default function WhatIsMemora() {
  return (
    <div>
      <h2 id="what-is-memora" className="text-2xl font-semibold text-sky-600 mb-4">What is Memora?</h2>
      <p className="text-slate-700 mb-6 leading-relaxed">Memora is a study assistant that helps you schedule, run, and reflect on study sessions so your memory improves predictably.</p>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-sm leading-6 text-slate-600">
          The docs are intentionally small: start with the core workflow, then expand into modules as you need them.
        </p>
      </div>

      <h3 id="core-ideas" className="text-lg font-semibold text-sky-600 mb-3">Core ideas</h3>
      <ol className="list-decimal list-inside space-y-2 text-slate-700 mb-6">
        <li>Keep topics small and actionable.</li>
        <li>Use MemScore to prioritize weak zones.</li>
        <li>Reflect quickly in Journal after each session.</li>
      </ol>

      <h3 id="getting-started" className="text-lg font-semibold text-sky-600 mb-3">Getting started</h3>
      <p className="text-slate-700 leading-relaxed">Begin with the Dashboard to see your study queue, then create your first Topic with resources attached.</p>
    </div>
  );
}
