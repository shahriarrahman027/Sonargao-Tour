import React, { useState } from 'react';
import { Camera, Trash2, Upload, X } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatDateTime } from '../lib/i18n';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';
import type { TourPhoto } from '../types/tour';

export const PhotosSection: React.FC = () => {
  const { lang, state, session, refreshState, showToast } = useTour();
  const [caption, setCaption] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTag, setActiveTag] = useState<string>('ALL');
  const [lightbox, setLightbox] = useState<TourPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!state) return null;

  const memberName = (id: string) => {
    const m = state.members.find((x) => x.id === id);
    return m ? (lang === 'bn' ? m.name_bn : m.name_en) : '';
  };

  const allTags = Array.from(new Set(state.photos.flatMap((p) => p.tags)));
  const visiblePhotos =
    activeTag === 'ALL' ? state.photos : state.photos.filter((p) => p.tags.includes(activeTag));

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await tourApi.uploadPhoto(file, caption.trim(), tags);
      soundEngine.playCelebration();
      setFile(null);
      setCaption('');
      setTagInput('');
      await refreshState();
      showToast(lang === 'bn' ? 'ছবি আপলোড হয়েছে!' : 'Memory uploaded!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: TourPhoto) => {
    if (!window.confirm(lang === 'bn' ? 'এই ছবিটি মুছে ফেলবেন?' : 'Delete this photo?')) return;
    await tourApi.deletePhoto(photo);
    setLightbox(null);
    await refreshState();
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
          {lang === 'bn' ? 'স্মৃতির অ্যালবাম' : 'PHOTOS & MEMORIES'}
        </span>
        <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
          {lang === 'bn' ? 'ট্যুরের সেরা মুহূর্তগুলো' : 'Shared Photo Journal'}
        </h2>
      </div>

      {/* Upload Form */}
      <form
        onSubmit={handleUpload}
        className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Upload className="w-4 h-4 text-[#14452F] dark:text-[#D4AF37]" />
          <span>{lang === 'bn' ? 'নতুন ছবি শেয়ার করুন (সর্বোচ্চ ৫MB)' : 'Upload a Photo (max 5 MB, JPG/PNG/WebP)'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="rounded-xl border border-dashed border-[#14452F]/30 dark:border-white/20 px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={lang === 'bn' ? 'ক্যাপশন লিখুন...' : 'Write a caption...'}
            className="rounded-xl border border-[#14452F]/15 dark:border-white/15 bg-transparent px-3.5 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder={lang === 'bn' ? 'ট্যাগ (কমা দিয়ে: পানাম, গ্রুপ)' : 'Tags (comma-separated)'}
              className="flex-1 rounded-xl border border-[#14452F]/15 dark:border-white/15 bg-transparent px-3.5 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={uploading || !file}
              className="rounded-xl bg-[#14452F] hover:bg-[#1B5B3E] disabled:opacity-50 text-white px-5 py-2 text-xs font-bold cursor-pointer"
            >
              {uploading ? '...' : lang === 'bn' ? 'আপলোড' : 'Post'}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-[#C45C3E] font-medium">{error}</p>}
      </form>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTag('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
              activeTag === 'ALL' ? 'bg-[#14452F] text-white' : 'bg-black/5 dark:bg-white/10'
            }`}
          >
            {lang === 'bn' ? 'সব ছবি' : 'All'}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                activeTag === tag ? 'bg-[#14452F] text-white' : 'bg-black/5 dark:bg-white/10'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Gallery Grid */}
      {visiblePhotos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#14452F]/20 dark:border-white/15 py-14 text-center space-y-2">
          <Camera className="w-8 h-8 mx-auto text-[#5C6A62]" />
          <p className="text-sm text-[#5C6A62]">
            {lang === 'bn'
              ? 'এখনো কোনো ছবি আপলোড হয়নি। ট্যুরের প্রথম ছবিটি আপনিই দিন!'
              : 'No photos uploaded yet. Share the first snapshot of the trip!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visiblePhotos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setLightbox(photo)}
              className="group rounded-3xl overflow-hidden bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 cursor-pointer shadow-xs hover:shadow-md transition"
            >
              <div className="aspect-[4/3] overflow-hidden bg-black/5">
                <img
                  src={photo.public_url}
                  alt={photo.caption || 'Tour memory'}
                  className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div className="p-4">
                {photo.caption && <p className="text-sm font-medium">{photo.caption}</p>}
                <div className="mt-2 flex items-center justify-between text-xs text-[#5C6A62]">
                  <span>{memberName(photo.uploaded_by)}</span>
                  <span>{formatDateTime(photo.created_at, lang)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-3xl w-full rounded-3xl bg-[#131F19] text-[#FAF7F0] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.public_url}
              alt={lightbox.caption}
              className="w-full max-h-[72vh] object-contain bg-black"
            />
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">{lightbox.caption || 'Tour Memory'}</p>
                <p className="text-xs text-white/65 mt-1">
                  {memberName(lightbox.uploaded_by)} • {formatDateTime(lightbox.created_at, lang)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(session?.isAdmin || session?.member.id === lightbox.uploaded_by) && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(lightbox)}
                    className="p-2 rounded-xl bg-[#C45C3E]/20 text-[#F49B82] hover:bg-[#C45C3E]/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
