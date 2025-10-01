import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const SearchableDropdown = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(option => option.id === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedOption ? 'text-gray-800' : 'text-gray-500'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown size={20} className={`text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search size={18} className="text-gray-400" />
              </span>
              <input
                type="text"
                placeholder="Search scripts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <ul>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <li
                  key={option.id}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 cursor-pointer hover:bg-blue-50"
                >
                  {option.name}
                </li>
              ))
            ) : (
              <li className="px-4 py-2 text-gray-500">No scripts found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
