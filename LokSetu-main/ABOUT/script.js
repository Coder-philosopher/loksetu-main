document.addEventListener("DOMContentLoaded", function () {

    // ─── 1. Navbar scroll state ───────────────────────────────────────
    const navbar = document.getElementById("navbar");
    function updateNavbar() {
        if (window.scrollY > 40) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    }
    window.addEventListener("scroll", updateNavbar, { passive: true });
    updateNavbar();


    // ─── 2. ScrollSpy (Active nav state) ─────────────────────────────
    const sections = document.querySelectorAll("section[id]");
    const navItems = document.querySelectorAll(".nav-links .nav-item");

    function updateActiveNav() {
        let current = "";
        sections.forEach((section) => {
            if (window.scrollY >= section.offsetTop - 180) {
                current = section.getAttribute("id");
            }
        });
        navItems.forEach((item) => {
            item.classList.toggle("active", item.getAttribute("href") === `#${current}`);
        });
    }
    window.addEventListener("scroll", updateActiveNav, { passive: true });
    updateActiveNav();


    // ─── 3. Reveal on scroll ─────────────────────────────────────────
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".hidden-el").forEach((el) => revealObserver.observe(el));


    // ─── 4. Smooth scroll for nav links ──────────────────────────────
    navItems.forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute("href"));
            if (target) {
                const offset = target.offsetTop - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72) - 20;
                window.scrollTo({ top: offset, behavior: "smooth" });
                // Close mobile menu if open
                navLinksEl.classList.remove("nav-open");
                hamburger.classList.remove("open");
            }
        });
    });


    // ─── 5. Hamburger mobile menu ─────────────────────────────────────
    const hamburger = document.getElementById("hamburger");
    const navLinksEl = document.getElementById("navLinks");
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("open");
        navLinksEl.classList.toggle("nav-open");
    });


    // ─── 6. Counter animation ─────────────────────────────────────────
    function animateCounter(el) {
        const target = parseInt(el.dataset.target, 10);
        const duration = 1400;
        const start = performance.now();
        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            el.textContent = Math.round(ease * target);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    const counterObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );
    document.querySelectorAll(".counter").forEach((el) => counterObserver.observe(el));


    // ─── 7. Animate fill bars ─────────────────────────────────────────
    // Store target widths before zeroing them, then animate on reveal
    const fillBars = document.querySelectorAll(".animated-fill");
    fillBars.forEach((bar) => {
        // Capture inline style width as target
        const target = bar.style.width;
        bar.dataset.targetWidth = target;
        bar.style.width = "0%";
    });

    const barObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const bar = entry.target;
                    // Small delay for visual delight
                    setTimeout(() => {
                        bar.style.transition = "width 1.4s cubic-bezier(0.25, 1, 0.5, 1)";
                        bar.style.width = bar.dataset.targetWidth;
                    }, 200);
                    barObserver.unobserve(bar);
                }
            });
        },
        { threshold: 0.3 }
    );
    fillBars.forEach((bar) => barObserver.observe(bar));


    // ─── 8. Hero image parallax (subtle) ─────────────────────────────
    const heroBgImg = document.getElementById("heroBgImg");
    if (heroBgImg) {
        window.addEventListener("scroll", () => {
            const scrolled = window.scrollY;
            if (scrolled < window.innerHeight) {
                heroBgImg.style.transform = `translateY(${scrolled * 0.25}px)`;
            }
        }, { passive: true });
    }

});