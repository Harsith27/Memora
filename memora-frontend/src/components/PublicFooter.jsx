import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Linkedin, Twitter } from 'lucide-react';
import Logo from './Logo';

const socialLinks = [
  { label: 'Twitter', href: '#', icon: Twitter },
  { label: 'LinkedIn', href: '#', icon: Linkedin },
  { label: 'GitHub', href: '#', icon: Github },
];

const footerColumns = [
  {
    title: 'Product',
    links: ['Dashboard', 'Topics', 'Journal', 'Mindmaps'],
  },
  {
    title: 'Company',
    links: ['About', 'Contact', 'Privacy'],
  },
];

function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/85">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/8 bg-gradient-to-b from-white/[0.05] to-white/[0.02] px-5 py-6 sm:px-7 sm:py-8 backdrop-blur-md">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
            <div>
              <Link to="/" className="inline-flex items-center gap-2 text-white hover:opacity-90 transition-opacity">
                <Logo size="sm" className="text-white" />
                <span className="font-semibold text-sm sm:text-base tracking-tight">Memora</span>
              </Link>

              <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-300/85">
                A focused memory system for revising smarter, tracking progress, and keeping your study flow organized.
              </p>

              <div className="mt-5 flex items-center gap-2.5 text-zinc-400">
                {socialLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      aria-label={item.label}
                      className="h-9 w-9 rounded-full border border-white/12 bg-black/50 flex items-center justify-center hover:text-white hover:border-white/25 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-2">
              {footerColumns.map((column) => (
                <div key={column.title}>
                  <h3 className="text-sm font-semibold text-white">{column.title}</h3>
                  <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                    {column.links.map((link) => (
                      <li key={link}>
                        <a href="#" className="transition-colors hover:text-zinc-200">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-zinc-400">
            <div className="flex flex-wrap items-center gap-3">
              <Link to="#" className="hover:text-zinc-200 transition-colors">Privacy</Link>
              <span className="opacity-40">|</span>
              <Link to="#" className="hover:text-zinc-200 transition-colors">Security</Link>
              <span className="opacity-40">|</span>
              <Link to="#" className="hover:text-zinc-200 transition-colors">Support</Link>
            </div>

            <p>© 2026 Memora. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
