/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Image, Send, X, ShieldAlert } from 'lucide-react';
import { User } from '../types';

interface CreatePostProps {
  currentUser: User | null;
  onPostCreated: (content: string, image?: string) => void;
}

export function CreatePost({ currentUser, onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const CHAR_LIMIT = 280;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || content.length > CHAR_LIMIT) return;

    onPostCreated(content, imageUrl.trim() ? imageUrl.trim() : undefined);
    
    // Reset form
    setContent('');
    setImageUrl('');
    setShowImageInput(false);
  };

  const imagePresets = [
    { name: 'Phaser Corridors', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80' },
    { name: 'OLED Abstract', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80' },
    { name: 'Cyberpunk Retro', url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80' }
  ];

  const charLeft = CHAR_LIMIT - content.length;
  const ratio = content.length / CHAR_LIMIT;

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 shadow-lg relative overflow-hidden transition-all duration-300">
      {/* Glow highlight strip on top */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-brand-orange/40 to-transparent" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start space-x-3.5">
          <img
            src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=82'}
            alt="Profile avatar"
            referrerPolicy="no-referrer"
            className="w-10 sm:w-11 h-10 sm:h-11 rounded-full border border-white/10 object-cover mt-1 flex-shrink-0"
          />
          <div className="flex-1 space-y-2">
            <textarea
              id="create-post-textarea"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post a terminal broadcast..."
              className="w-full bg-[#050505] text-white border border-white/5 focus:border-brand-orange/40 focus:ring-0 placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none transition-all font-sans"
            />
          </div>
        </div>

        {/* Dynamic Image Insertion helper */}
        {showImageInput && (
          <div className="ml-0 sm:ml-14 bg-black/60 border border-white/10 p-3.5 rounded-xl space-y-3.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
                Asset Simulation URL
              </label>
              <button
                id="close-image-input-btn"
                type="button"
                onClick={() => {
                  setImageUrl('');
                  setShowImageInput(false);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            
            <input
              id="image-url-manual-input"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste any Unsplash image URL..."
              className="w-full bg-black/80 border border-white/10 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-brand-orange font-mono"
            />

            {/* Presets Grid to help user instantly inject elegant assets */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                Presets (Click to apply)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {imagePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setImageUrl(preset.url)}
                    className={`p-1.5 text-[9px] font-mono border rounded-lg transition-all truncate text-center ${
                      imageUrl === preset.url
                        ? 'border-brand-orange bg-brand-orange/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {imageUrl.trim() && (
              <div className="relative rounded-lg overflow-hidden border border-white/10 max-h-40">
                <img
                  src={imageUrl}
                  alt="Attachment preview"
                  className="w-full object-cover max-h-40"
                  onError={(e) => {
                    // Fail gracefully
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer actions of drafting card */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3 ml-0 sm:ml-14">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="post-creator-add-image-icon-btn"
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className={`p-2 rounded-xl transition-all ${
                showImageInput || imageUrl
                  ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
              title="Add simulated attachment"
            >
              <Image size={18} />
            </button>
          </div>

          <div className="flex items-center space-x-3.5">
            {/* Character limit spinner */}
            {content.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono ${charLeft < 20 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {charLeft}
                </span>
                <svg className="w-5 h-5 transform -rotate-90">
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    className="stroke-white/10"
                    strokeWidth="2"
                    fill="transparent"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    className={`transition-all duration-300 ${charLeft < 0 ? 'stroke-red-500' : 'stroke-brand-orange'}`}
                    strokeWidth="2"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 8}
                    strokeDashoffset={2 * Math.PI * 8 * (1 - Math.min(ratio, 1))}
                  />
                </svg>
              </div>
            )}

            <button
              id="broadcast-send-submit-btn"
              type="submit"
              disabled={!content.trim() || content.length > CHAR_LIMIT}
              className={`px-4 sm:px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase font-sans transition-all flex items-center space-x-1.5 shadow-md ${
                content.trim() && content.length <= CHAR_LIMIT
                  ? 'bg-brand-orange hover:bg-brand-orange-hover text-white shadow-brand-orange/10'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <span>Broadcast</span>
              <Send size={12} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
