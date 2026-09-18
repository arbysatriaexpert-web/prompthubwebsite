/**
 * CachedMedia.jsx — PromptHub v5.5
 *
 * Tiga komponen pengganti <img> dan <video> biasa:
 *
 *   <CachedImage src=... />   gambar, dimuat lewat cache device
 *   <CachedVideo src=... />   video, TIDAK pernah diunduh sebelum terlihat
 *   <CardMedia url=... />     otomatis pilih salah satu dari ekstensi file
 *
 * Kenapa penting untuk egress:
 *  - <video autoPlay> pada kartu grid mengunduh SELURUH video begitu halaman
 *    dibuka, untuk setiap kartu, setiap kali. Di sini video baru diunduh
 *    ketika kartunya benar-benar masuk layar, dan hanya sekali seumur device.
 *  - Kunjungan kedua dan seterusnya membaca dari IndexedDB: nol byte ke Supabase.
 */

import { useEffect, useRef, useState } from 'react';
import { getCachedMediaUrl, hasCachedMedia } from '../lib/mediaCache';

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;

export function isVideoUrl(url = '') {
  return VIDEO_RE.test(url || '');
}

/** Batas ukuran video thumbnail yang boleh disimpan penuh di device. */
const THUMB_VIDEO_MAX_BYTES = 12 * 1024 * 1024; // 12 MB

/* ------------------------------------------------------------------ */

/** Hook kecil: true ketika elemen sudah (pernah) masuk viewport. */
function useInView(ref, { rootMargin = '200px', once = true } = {}) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, once]);

  return inView;
}

/* ------------------------------------------------------------------ */

export function CachedImage({
  src,
  alt = '',
  className,
  style,
  eager = false,
  onError,
  ...rest
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { rootMargin: '300px' });
  const [resolved, setResolved] = useState('');

  useEffect(() => {
    let alive = true;
    if (!src) { setResolved(''); return; }
    if (!eager && !inView) return;

    getCachedMediaUrl(src)
      .then((url) => { if (alive) setResolved(url); })
      .catch(() => { if (alive) setResolved(src); });

    return () => { alive = false; };
  }, [src, inView, eager]);

  return (
    <img
      ref={ref}
      src={resolved || undefined}
      alt={alt}
      className={className}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={onError}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */

/**
 * Video hemat kuota.
 *
 * mode="inview"  → ikut diputar otomatis (muted, loop) begitu masuk layar.
 *                  Cocok untuk thumbnail kartu.
 * mode="click"   → tampil poster + tombol play; video baru diunduh setelah
 *                  ditekan. Cocok untuk video panjang di halaman detail.
 */
export function CachedVideo({
  src,
  poster,
  className,
  style,
  mode = 'inview',
  controls = false,
  maxBytes = THUMB_VIDEO_MAX_BYTES,
  ...rest
}) {
  const holderRef = useRef(null);
  const videoRef = useRef(null);
  const inView = useInView(holderRef, { rootMargin: '150px' });

  const [activated, setActivated] = useState(mode === 'inview');
  const [resolved, setResolved] = useState('');
  const [alreadyCached, setAlreadyCached] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!src) return;
    hasCachedMedia(src).then((yes) => { if (alive) setAlreadyCached(yes); });
    return () => { alive = false; };
  }, [src]);

  useEffect(() => {
    let alive = true;
    if (!src) { setResolved(''); return; }
    if (!activated) return;
    if (mode === 'inview' && !inView) return;

    getCachedMediaUrl(src, { maxBytes })
      .then((url) => { if (alive) setResolved(url); })
      .catch(() => { if (alive) setResolved(src); });

    return () => { alive = false; };
  }, [src, activated, inView, mode, maxBytes]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !resolved) return;
    if (mode === 'inview') {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay ditolak — biarkan */ });
    }
  }, [resolved, mode]);

  const needsButton = mode === 'click' && !activated && !alreadyCached;

  /**
   * Jangan pernah memaksa `position: relative` lewat inline style kalau
   * pemanggil sudah memberi className. Inline style selalu menang atas CSS,
   * jadi `position: relative` akan menimpa `.card-bg { position: absolute }`
   * dan merusak tata letak kartu di Home maupun Tools. Kalau tidak ada
   * className, barulah wrapper dibuat relative supaya tombol play punya
   * induk yang terposisi.
   */
  const wrapperStyle = className
    ? { overflow: 'hidden', background: '#000', ...style }
    : { position: 'relative', overflow: 'hidden', background: '#000', ...style };

  return (
    <div ref={holderRef} className={className} style={wrapperStyle}>
      {poster && !resolved && (
        <img
          src={poster}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {resolved && (
        <video
          ref={videoRef}
          src={resolved}
          poster={poster || undefined}
          muted={mode === 'inview'}
          loop={mode === 'inview'}
          autoPlay={mode === 'inview'}
          controls={controls || mode === 'click'}
          playsInline
          preload="none"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          {...rest}
        />
      )}

      {needsButton && (
        <button
          type="button"
          aria-label="Putar video"
          onClick={() => setActivated(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            border: 'none', background: poster ? 'transparent' : 'rgba(0,0,0,0.35)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, lineHeight: 1, paddingLeft: 3,
          }}>▶</span>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Dipakai di kartu Home / Tools / Favorit.
 * Menggantikan blok `url.match(/\.(mp4|webm|ogg)$/) ? <video autoPlay .../> : <img .../>`
 * yang selama ini jadi penyedot egress terbesar.
 */
export function CardMedia({ url, alt = '', className, style, emptyClassName = 'card-bg empty-bg' }) {
  if (!url) return <div className={emptyClassName} style={style} />;

  if (isVideoUrl(url)) {
    return (
      <CachedVideo
        src={url}
        mode="inview"
        className={className}
        style={{ objectFit: 'cover', ...style }}
      />
    );
  }

  return (
    <CachedImage
      src={url}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
    />
  );
}

export default CardMedia;
