/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { X, Camera, MapPin, Link as LinkIcon, Edit2, Check, ShieldAlert } from 'lucide-react';
import { User } from '../types';
import { Cropper } from './Cropper';

interface ProfileEditModalProps {
  currentUser: User;
  onClose: () => void;
  onSave: (displayName: string, bio: string, avatar: string, coverImage: string, location?: string, website?: string) => void;
  onToast: (msg: string) => void;
}

export function ProfileEditModal({
  currentUser,
  onClose,
  onSave,
  onToast
}: ProfileEditModalProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio);
  const [location, setLocation] = useState(currentUser.location || '');
  const [website, setWebsite] = useState(currentUser.website || '');
  
  // Image states
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [coverImage, setCoverImage] = useState(currentUser.coverImage);

  // Cropper specific state flow
  const [cropSource, setCropSource] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('Please select a valid image file formats');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Feed raw image to the cropper panel
        setCropSource(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBase64: string) => {
    setAvatar(croppedBase64);
    setCropSource(null);
    onToast('Cropped avatar staged!');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      onToast('Display name cannot be empty');
      return;
    }
    
    onSave(
      displayName.trim(),
      bio.trim(),
      avatar,
      coverImage.trim(),
      location.trim() || undefined,
      website.trim() || undefined
    );
    onToast('Profile updated successfully!');
    onClose();
  };

  // Cover image URL custom simulation helper
  const handleCoverPaste = () => {
    const bannerPresets = [
      'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1200',
      'https://images.unsplash.com/photo-1614027164847-1b2809eb7b9b?w=1200',
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200'
    ];
    // Cycle array
    const nextBanner = bannerPresets[Math.floor(Math.random() * bannerPresets.length)];
    setCoverImage(nextBanner);
    onToast('Simulated cover image cycler injected!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn">
      {/* If cropSource is active, take absolute precedence to show the Cropper interface right here */}
      {cropSource ? (
        <div className="animate-scaleIn z-50">
          <Cropper
            imageSrc={cropSource}
            onCropComplete={handleCropComplete}
            onCancel={() => setCropSource(null)}
          />
        </div>
      ) : (
        <div className="w-full max-w-lg bg-[#080808] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-scaleIn">
          {/* Header of Modal */}
          <div className="flex items-center justify-between p-4 border-b border-white/15">
            <div className="flex items-center space-x-3">
              <button
                id="edit-profile-close-btn"
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
              <h2 className="font-semibold text-base sm:text-lg text-white">
                Edit Glaze Profile
              </h2>
            </div>
            
            <button
              id="edit-profile-save-btn"
              onClick={handleSubmit}
              className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-full tracking-wider uppercase transition-all flex items-center space-x-1"
            >
              <Check size={13} />
              <span>Save</span>
            </button>
          </div>

          {/* Form Content body (Scrollable) */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
            {/* Aspect Banner / Cover image custom input */}
            <div className="relative rounded-xl overflow-hidden border border-white/10 group">
              <div className="h-32 bg-zinc-900 overflow-hidden relative">
                <img
                  src={coverImage}
                  alt="Cover banner preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                  <button
                    id="edit-profile-banner-cycle-btn"
                    type="button"
                    onClick={handleCoverPaste}
                    className="p-2.5 rounded-full bg-brand-orange text-white hover:scale-110 shadow-lg shadow-brand-orange/20 transition-all flex items-center space-x-1"
                    title="Change cover photo"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              {/* Float Avatar representation */}
              <div className="absolute -bottom-10 left-4 sm:left-6 w-20 sm:w-24 h-20 sm:h-24 rounded-full border-4 border-[#080808] overflow-hidden bg-zinc-800 shadow-xl group/avatar">
                <img
                  src={avatar}
                  alt="Avatar representation"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover/avatar:opacity-80 transition-opacity"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                  <button
                    id="crop-avatar-trigger-btn"
                    type="button"
                    onClick={triggerFileInput}
                    className="p-1.5 rounded-full bg-brand-orange text-white"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Ghost input for local upload targeting avatar cropping */}
            <input
              id="cropper-local-file-input"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Spacer to absorb absolute float avatar shift */}
            <div className="h-4" />

            {/* Basic user values */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-brand-orange font-bold orange-glow-text">
                  Cropper Local Upload
                </label>
                <button
                  id="cropper-trigger-button"
                  type="button"
                  onClick={triggerFileInput}
                  className="w-full border border-dashed border-white/20 hover:border-brand-orange/40 p-2.5 rounded-xl text-xs font-mono text-gray-400 hover:text-white hover:bg-white/[0.02] transition-all flex items-center justify-center space-x-2"
                >
                  <Camera size={14} className="text-brand-orange" />
                  <span>Choose local file to crop as Avatar</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
                  Display name
                </label>
                <input
                  id="edit-profile-display-name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-black border border-white/10 focus:border-brand-orange/40 focus:ring-0 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition-all"
                  placeholder="The Nigerian"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
                  Bio Broadcaster
                </label>
                <textarea
                  id="edit-profile-bio-textarea"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={170}
                  className="w-full bg-black border border-white/10 focus:border-brand-orange/40 focus:ring-0 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none transition-all font-sans"
                  placeholder="Share details about your terminal..."
                />
                <span className="text-[9px] font-mono text-gray-500 float-right">
                  {bio.length}/170 characters
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
                    <MapPin size={12} className="text-brand-orange" />
                    <span>Location</span>
                  </div>
                  <input
                    id="edit-profile-location-input"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-black border border-white/10 focus:border-brand-orange/40 focus:ring-0 text-white rounded-xl px-3 py-2 text-xs focus:outline-none transition-all"
                    placeholder="Lagos, Nigeria"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">
                    <LinkIcon size={12} className="text-brand-orange" />
                    <span>Website link</span>
                  </div>
                  <input
                    id="edit-profile-website-input"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full bg-black border border-white/10 focus:border-brand-orange/40 focus:ring-0 text-white rounded-xl px-3 py-2 text-xs focus:outline-none transition-all"
                    placeholder="https://swordofmilligan.com"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
