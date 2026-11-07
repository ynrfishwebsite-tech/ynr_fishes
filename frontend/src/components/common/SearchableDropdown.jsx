import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

/**
 * SearchableDropdown
 * Hybrid Search & Select Dropdown Component
 *
 * Supports two primary modes:
 *  1. mode="select": Replaces standard <select> with a searchable, rich dropdown
 *     that opens strictly beneath the trigger element on all devices (mobile, tablet, desktop).
 *  2. mode="combobox": Hybrid text input + searchable suggestions (replaces <input list="..." /> + <datalist>).
 *     Allows free-form typing while providing a dropdown anchored directly below the field.
 *
 * Automatically handles mobile viewport, keyboard opening, scroll tracking, and portal mounting
 * so it is never clipped by table overflow-x-auto or card overflow-hidden containers.
 */
const SearchableDropdown = ({
  mode = 'select', // 'select' | 'combobox'
  options = [],
  value = '',
  onChange = () => {},
  onSelect = null, // Optional callback when an item is chosen from the list
  placeholder = '-- Select --',
  searchPlaceholder = 'Search...',
  disabled = false,
  required = false,
  className = '',
  inputClassName = '',
  dropdownClassName = '',
  accentColor = 'orange', // 'orange' | 'blue' | 'emerald' | 'amber' | 'slate'
  searchable = true,
  minDropdownWidth = 260,
  maxHeight = 280,
  emptyMessage = 'No matching options found',
  clearable = true,
  name = '',
  id = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [coords, setCoords] = useState(null);

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsListRef = useRef(null);

  // Normalize options into uniform { value, label, subtitle, badge, badgeColor, raw } objects
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt), raw: opt };
      }
      return {
        value: opt.value !== undefined ? String(opt.value) : String(opt.name || opt.label || ''),
        label: opt.label !== undefined ? String(opt.label) : String(opt.name || opt.value || ''),
        subtitle: opt.subtitle || '',
        badge: opt.badge || '',
        badgeColor: opt.badgeColor || '',
        isSpecial: opt.isSpecial || false,
        raw: opt.raw || opt
      };
    });
  }, [options]);

  // Find currently selected option for 'select' mode
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = (mode === 'combobox' ? searchQuery || value || '' : searchQuery).trim().toLowerCase();
    if (!q) return normalizedOptions;

    return normalizedOptions.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchSub = opt.subtitle ? opt.subtitle.toLowerCase().includes(q) : false;
      const matchVal = opt.value ? opt.value.toLowerCase().includes(q) : false;
      return matchLabel || matchSub || matchVal;
    });
  }, [normalizedOptions, searchQuery, value, mode]);

  // Compute position relative to viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // If trigger element is completely scrolled out of view, close
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const minW = minDropdownWidth || 240;
    let width = Math.max(rect.width, minW);
    const maxViewportWidth = window.innerWidth - 16;
    if (width > maxViewportWidth) width = maxViewportWidth;

    // Align left with trigger, but keep inside viewport margins
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    if (left < 8) left = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const targetHeight = Math.min(maxHeight, 320);

    let top = 'auto';
    let bottom = 'auto';
    let effectiveMaxHeight = targetHeight;

    // If bottom space is too cramped (e.g. keyboard is up or at screen bottom) and top has more room
    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      bottom = window.innerHeight - rect.top + 4;
      effectiveMaxHeight = Math.min(targetHeight, Math.max(140, spaceAbove - 20));
    } else {
      top = rect.bottom + 4;
      effectiveMaxHeight = Math.min(targetHeight, Math.max(140, spaceBelow - 20));
    }

    setCoords({
      top,
      bottom,
      left,
      width,
      maxHeight: effectiveMaxHeight
    });
  }, [minDropdownWidth, maxHeight]);

  // Keep position updated on scroll and resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    // Listen on window and capture nested scrollable elements
    const handleScroll = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleScroll);
      window.visualViewport.addEventListener('scroll', handleScroll);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleScroll);
        window.visualViewport.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isOpen, updatePosition]);

  // Close when tapping/clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        containerRef.current &&
        containerRef.current.contains(e.target)
      ) {
        return;
      }
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('touchstart', handleOutsideClick, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('touchstart', handleOutsideClick, true);
    };
  }, [isOpen]);

  // Auto focus search input when dropdown opens in 'select' mode
  useEffect(() => {
    if (isOpen && mode === 'select' && searchable && searchInputRef.current) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, mode, searchable]);

  // Reset highlight index when filtered options change
  useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [filteredOptions.length]);

  // Handle option selection
  const handleSelectOption = (opt) => {
    if (onSelect) {
      onSelect(opt.raw || opt);
    }
    onChange(opt.value, opt);
    if (mode === 'combobox') {
      setSearchQuery('');
    }
    setIsOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (
      isOpen &&
      highlightedIndex >= 0 &&
      optionsListRef.current &&
      optionsListRef.current.children[highlightedIndex]
    ) {
      const activeEl = optionsListRef.current.children[highlightedIndex];
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Color mappings based on accentColor
  const themeClasses = useMemo(() => {
    switch (accentColor) {
      case 'blue':
        return {
          borderFocus: 'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          borderActive: 'border-blue-500 ring-1 ring-blue-500',
          searchFocus: 'focus:border-blue-500 focus:ring-blue-200',
          itemHover: 'hover:bg-blue-50/80',
          itemActive: 'bg-blue-50 text-blue-900 font-bold',
          badgeDefault: 'bg-blue-100 text-blue-800 border-blue-200',
          highlight: 'text-blue-600 font-extrabold underline decoration-blue-300'
        };
      case 'emerald':
        return {
          borderFocus: 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
          borderActive: 'border-emerald-500 ring-1 ring-emerald-500',
          searchFocus: 'focus:border-emerald-500 focus:ring-emerald-200',
          itemHover: 'hover:bg-emerald-50/80',
          itemActive: 'bg-emerald-50 text-emerald-900 font-bold',
          badgeDefault: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          highlight: 'text-emerald-700 font-extrabold underline decoration-emerald-300'
        };
      case 'amber':
        return {
          borderFocus: 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500',
          borderActive: 'border-amber-500 ring-1 ring-amber-500',
          searchFocus: 'focus:border-amber-500 focus:ring-amber-200',
          itemHover: 'hover:bg-amber-50/80',
          itemActive: 'bg-amber-50 text-amber-900 font-bold',
          badgeDefault: 'bg-amber-100 text-amber-800 border-amber-200',
          highlight: 'text-amber-700 font-extrabold underline decoration-amber-300'
        };
      case 'orange':
      default:
        return {
          borderFocus: 'focus:border-[#ea580c] focus:ring-1 focus:ring-orange-400',
          borderActive: 'border-[#ea580c] ring-1 ring-orange-400',
          searchFocus: 'focus:border-[#ea580c] focus:ring-orange-200',
          itemHover: 'hover:bg-orange-50/80',
          itemActive: 'bg-orange-50 text-[#ea580c] font-bold',
          badgeDefault: 'bg-orange-100 text-[#ea580c] border-orange-200',
          highlight: 'text-[#ea580c] font-extrabold underline decoration-orange-300'
        };
    }
  }, [accentColor]);

  // Highlight matching letters in label
  const renderHighlightedText = (text, query) => {
    if (!query || !query.trim()) return text;
    const q = query.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + q.length);
    const after = text.substring(idx + q.length);

    return (
      <>
        {before}
        <span className={themeClasses.highlight}>{match}</span>
        {after}
      </>
    );
  };

  const activeQuery = mode === 'combobox' ? searchQuery || value || '' : searchQuery;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* ── Hidden input for native HTML form submission / validation ── */}
      {required && (
        <input
          type="text"
          name={name}
          id={id ? `${id}-required-check` : undefined}
          value={value || ''}
          onChange={() => {}}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only opacity-0 h-0 w-0 absolute pointer-events-none"
        />
      )}

      {/* ── TRIGGER: SELECT MODE ── */}
      {mode === 'select' && (
        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              setSearchQuery('');
            }
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 text-left flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
            isOpen ? themeClasses.borderActive : themeClasses.borderFocus
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-slate-400'} ${inputClassName}`}
        >
          <span className={`truncate block flex-1 ${!selectedOption ? 'text-slate-400 font-normal' : 'text-slate-800 font-bold'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
            {clearable && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('', null);
                }}
                className="p-0.5 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
              >
                <X size={13} />
              </span>
            )}
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 text-slate-500 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
      )}

      {/* ── TRIGGER: COMBOBOX / HYBRID AUTOCOMPLETE MODE ── */}
      {mode === 'combobox' && (
        <div className="relative w-full">
          <input
            ref={triggerRef}
            type="text"
            id={id}
            name={name}
            disabled={disabled}
            placeholder={placeholder}
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              onChange(val, null);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
                setSearchQuery(value || '');
              }
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            className={`w-full bg-white border border-[#E8DCCB] rounded-xl pl-3 pr-14 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all ${
              isOpen ? themeClasses.borderActive : themeClasses.borderFocus
            } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-slate-400'} ${inputClassName}`}
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {clearable && value && !disabled && (
              <button
                type="button"
                onClick={() => {
                  onChange('', null);
                  setSearchQuery('');
                }}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Clear input"
              >
                <X size={13} />
              </button>
            )}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                if (!disabled) {
                  setIsOpen((prev) => !prev);
                  setSearchQuery('');
                }
              }}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Toggle list"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-700' : ''}`}
              />
            </button>
          </div>
        </div>
      )}

      {/* ── DROPDOWN PORTAL (Always strictly below the field, never clipped) ── */}
      {isOpen && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.top !== 'auto' ? `${coords.top}px` : 'auto',
            bottom: coords.bottom !== 'auto' ? `${coords.bottom}px` : 'auto',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            zIndex: 99999
          }}
          className={`bg-white border border-[#E8DCCB] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 select-none ${dropdownClassName}`}
        >
          {/* Top Search bar for 'select' mode */}
          {mode === 'select' && searchable && (
            <div className="p-2 border-b border-[#fed7aa]/50 bg-[#FDFBF7] shrink-0">
              <div className="relative w-full">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full bg-white border border-[#E8DCCB] rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all ${themeClasses.searchFocus}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="overflow-y-auto flex-1 divide-y divide-[#fed7aa]/30 overscroll-contain py-1"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelectOption(opt)}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors min-h-[40px] ${
                      isSelected
                        ? themeClasses.itemActive
                        : isHighlighted
                        ? themeClasses.itemHover
                        : 'text-slate-700 hover:bg-slate-50'
                    } ${opt.isSpecial ? 'bg-emerald-50/50 hover:bg-emerald-100/50 font-bold text-emerald-800' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold ${isSelected ? 'font-bold' : ''}`}>
                          {renderHighlightedText(opt.label, activeQuery)}
                        </span>
                        {opt.badge && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold border ${
                              opt.badgeColor === 'emerald'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : opt.badgeColor === 'amber'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : opt.badgeColor === 'rose'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : opt.badgeColor === 'slate'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : themeClasses.badgeDefault
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>

                      {opt.subtitle && (
                        <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {renderHighlightedText(opt.subtitle, activeQuery)}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        className={`shrink-0 ${
                          accentColor === 'blue'
                            ? 'text-blue-600'
                            : accentColor === 'emerald'
                            ? 'text-emerald-600'
                            : accentColor === 'amber'
                            ? 'text-amber-600'
                            : 'text-[#ea580c]'
                        }`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableDropdown;

