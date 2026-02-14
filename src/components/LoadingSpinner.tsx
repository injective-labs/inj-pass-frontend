'use client';

/**
 * Reusable loading spinner component
 * Used for page transitions and loading states
 */
export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
    </div>
  );
}
