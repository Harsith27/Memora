import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const ShadcnSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  menuPlacement = 'bottom'
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  const handleSelect = (nextValue) => {
    if (disabled) return;
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} data-shadcn-select-root="true" className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={`w-full inline-flex items-center justify-between rounded-lg border border-white/20 bg-black px-3 py-2 text-sm text-white transition-colors ${
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/50'
        }`}
      >
        <span className={`${selectedOption ? 'text-white' : 'text-gray-400'} truncate`}>
          <span style={selectedOption?.style || null}>{selectedOption?.label || placeholder}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div data-shadcn-select-menu="true" className={`absolute z-50 w-full overflow-hidden rounded-lg border border-white/15 bg-[#050505] shadow-[0_10px_30px_rgba(0,0,0,0.65)] ${menuPlacement === 'top' ? 'bottom-full mb-1' : 'mt-1'}`}>
          <ul className="max-h-64 overflow-auto scrollbar-themed py-1 overscroll-contain">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-violet-500/15 text-violet-300'
                        : 'text-gray-200 hover:bg-violet-500/10'
                    }`}> 
                      <span className="truncate" style={option.style || null}>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ShadcnSelect;
