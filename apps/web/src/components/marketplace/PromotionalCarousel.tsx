import { useEffect, useState, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export interface PromotionSlide {
  label: string;
  title: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  href: string;
  action: string;
}

interface PromotionalCarouselProps {
  slides: PromotionSlide[];
}

export default function PromotionalCarousel({ slides }: PromotionalCarouselProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    if (slides.length < 2) return;

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  const showSlide = (index: number) => {
    setActiveSlide((index + slides.length) % slides.length);
  };
  const currentSlide = slides.length > 0 ? activeSlide % slides.length : 0;

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchStart === null) return;
    const touchDistance = touchStart - event.changedTouches[0].clientX;
    if (Math.abs(touchDistance) > 45) {
      showSlide(activeSlide + (touchDistance > 0 ? 1 : -1));
    }
    setTouchStart(null);
  };

  if (slides.length === 0) return null;

  return (
    <section
      aria-label="Marketplace highlights"
      aria-roledescription="carousel"
      className="relative isolate min-h-[340px] overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-orange-950 via-rose-950 to-slate-900 shadow-xl sm:min-h-[360px]"
      onTouchStart={(event) => setTouchStart(event.touches[0].clientX)}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setTouchStart(null)}
    >
      <div className="absolute -right-10 -top-16 -z-10 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

      {slides.map((slide, index) => (
        <article
          key={`${slide.label}-${slide.title}-${index}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${slides.length}`}
          aria-hidden={index !== currentSlide}
          className={`absolute inset-0 flex items-center p-6 pb-16 transition duration-500 ease-out sm:p-9 ${
            index === currentSlide
              ? "pointer-events-auto translate-x-0 opacity-100"
              : index < activeSlide
                ? "pointer-events-none -translate-x-8 opacity-0"
                : "pointer-events-none translate-x-8 opacity-0"
          }`}
        >
          <div className="relative z-10 flex w-full items-center justify-between gap-4">
            <div className="max-w-xl space-y-3 sm:space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">
                {slide.label}
              </p>
              <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                {slide.title}
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-orange-50/75">
                {slide.description}
              </p>
              <Link
                to={slide.href}
                tabIndex={index === currentSlide ? 0 : -1}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-black text-slate-950 transition hover:bg-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {slide.action}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            {slide.imageUrl && (
              <div className="hidden h-44 w-40 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-3 sm:flex lg:h-56 lg:w-52">
                <img
                  src={slide.imageUrl}
                  alt={slide.imageAlt ?? ""}
                  className="h-full w-full object-contain drop-shadow-2xl"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
              </div>
            )}
          </div>
        </article>
      ))}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous promotion"
            onClick={() => showSlide(activeSlide - 1)}
            className="absolute bottom-3 left-3 top-auto z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/50 text-white transition hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-auto sm:left-5 sm:top-1/2 sm:-translate-y-1/2"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Next promotion"
            onClick={() => showSlide(activeSlide + 1)}
            className="absolute bottom-3 right-3 top-auto z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/50 text-white transition hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-[1.1rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={`dot-${slide.title}-${index}`}
                type="button"
                aria-label={`Show promotion ${index + 1}`}
                aria-current={index === currentSlide}
                onClick={() => showSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide ? "w-6 bg-brand" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
