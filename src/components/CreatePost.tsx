/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Image, Send, X } from 'lucide-react';
import { User } from '../types';

interface CreatePostProps {
  currentUser: User | null;
  onPostCreated: (content: string, image?: string) => void;
}

const FILESTACK_API_KEY = import.meta.env.VITE_FILESTACK_API_KEY || '';

function getFilestackUrl(result: any): string {
  const file = result?.filesUploaded?.[0] || result;
  if (!file) return '';
  return file.url || (file.handle ? `https://cdn.filestackcontent.com/${file.handle}` : '');
}

function loadFilestackScript(): Promise<any> {
  const existingClient = (window as any).filestack;
  if (existingClient) return Promise.resolve(existingClient);

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('filestack-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).filestack));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'filestack-js-sdk';
    script.src = 'https://static.filestackapi.com/filestack-js/3.x.x/filestack.min.js';
    script.async = true;
    script.onload = () => resolve((window as any).filestack);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export function CreatePost({ currentUser, onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const CHAR_LIMIT = 280;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || content.length > CHAR_LIMIT) return;

    onPostCreated(content, imageUrl.trim() ? imageUrl.trim() : undefined);
    setContent('');
    setImageUrl('');
  };

  const openFilestackPicker = async () => {
    if (!FILESTACK_API_KEY || isUploading) return;

    try {
      setIsUploading(true);
      const filestack = await loadFilestackScript();
      const client = filestack.init(FILESTACK_API_KEY);
      client.picker({
        accept: ['image/*'],
        maxFiles: 1,
        fromSources: ['local_file_system', 'url'],
        onUploadDone: (result: any) => {
          const uploadedUrl = getFilestackUrl(result);
          if (uploadedUrl) setImageUrl(uploadedUrl);
          setIsUploading(false);
        },
        onClose: () => setIsUploading(false)
      }).open();
    } catch (error) {
      console.error('Filestack picker failed:', error);
      setIsUploading(false);
    }
  };

  const charLeft = CHAR_LIMIT - content.length;
  const ratio = content.length / CHAR_LIMIT;

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/5 shadow-lg relative overflow-hidden transition-all duration-300">
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
              placeholder="What's happening?"
              className="w-full bg-[#050505] text-white border border-white/5 focus:border-brand-orange/40 focus:ring-0 placeholder-gray-500 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none transition-all font-sans"
            />
          </div>
        </div>

        {imageUrl.trim() && (
          <div className="ml-0 sm:ml-14 relative rounded-xl overflow-hidden border border-white/10 max-h-56 bg-black/60 animate-fadeIn">
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/70 text-white hover:bg-black border border-white/10"
              aria-label="Remove image"
            >
              <X size={14} />
            </button>
            <img
              src={imageUrl}
              alt="Post attachment preview"
              className="w-full object-cover max-h-56"
            />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/5 pt-3 ml-0 sm:ml-14">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="post-creator-add-image-icon-btn"
              type="button"
              onClick={openFilestackPicker}
              disabled={!FILESTACK_API_KEY || isUploading}
              className={`p-2 rounded-xl transition-all ${
                imageUrl
                  ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/25'
                  : FILESTACK_API_KEY && !isUploading
                    ? 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    : 'text-gray-700 cursor-not-allowed border border-white/5'
              }`}
              title={FILESTACK_API_KEY ? 'Add image' : 'Filestack API key missing'}
            >
              <Image size={18} />
            </button>
          </div>

          <div className="flex items-center space-x-3.5">
            {content.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono ${charLeft < 20 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                  {charLeft}
                </span>
                <svg className="w-5 h-5 transform -rotate-90">
                  <circle cx="10" cy="10" r="8" className="stroke-white/10" strokeWidth="2" fill="transparent" />
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
              id="post-send-submit-btn"
              type="submit"
              disabled={!content.trim() || content.length > CHAR_LIMIT}
              className={`px-4 sm:px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase font-sans transition-all flex items-center space-x-1.5 shadow-md ${
                content.trim() && content.length <= CHAR_LIMIT
                  ? 'bg-brand-orange hover:bg-brand-orange-hover text-white shadow-brand-orange/10'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <span>Post</span>
              <Send size={12} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
