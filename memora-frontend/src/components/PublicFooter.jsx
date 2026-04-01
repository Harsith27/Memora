import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Instagram, Linkedin, Twitter } from 'lucide-react';
import Logo from './Logo';

const socialLinks = [
  { label: 'Twitter', href: '#', icon: Twitter },
  { label: 'Instagram', href: '#', icon: Instagram },
  { label: 'LinkedIn', href: '#', icon: Linkedin },
  { label: 'GitHub', href: '#', icon: Github },
];

function PublicFooter() {
  return (
    <footer className="border-t border-white/10 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center gap-2 text-white hover:opacity-90 transition-opacity">
          <Logo size="sm" className="text-white" />
          <span className="font-semibold tracking-tight">Memora</span>
        </Link>

        <div className="flex items-center gap-3 text-zinc-400">
          {socialLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="h-9 w-9 rounded-full border border-white/12 bg-black/60 flex items-center justify-center hover:text-white hover:border-white/25 transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            );
          })}
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
