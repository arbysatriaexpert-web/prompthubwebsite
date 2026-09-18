/**
 * RouteFallback.jsx — PromptHub v5.5
 *
 * Ditampilkan sementara chunk halaman sedang diunduh (React.lazy + Suspense).
 * Sengaja sangat ringan: tidak mengimpor ikon atau CSS tambahan, supaya
 * tidak menambah ukuran bundel utama.
 */

export default function RouteFallback({ minHeight = '60vh' }) {
  return (
    <div
      style={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: 'var(--accent, #6366f1)',
          animation: 'ph-spin 0.7s linear infinite',
        }}
      />
      <style>{'@keyframes ph-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
