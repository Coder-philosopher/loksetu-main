document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. ScrollSpy (Active Navbar State) ---
    const sections = document.querySelectorAll("section");
    const navLi = document.querySelectorAll(".nav-links .nav-item");

    window.addEventListener('scroll', () => {
        let current = "";
        
        sections.forEach((section) => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            // -150 offset handles the sticky navbar height
            if (pageYOffset >= sectionTop - 150) { 
                current = section.getAttribute("id");
            }
        });

        navLi.forEach((li) => {
            li.classList.remove("active");
            if (li.getAttribute("href") === `#${current}`) {
                li.classList.add("active");
            }
        });
    });

    // --- 2. Advanced Reveal Animation (Intersection Observer) ---
    const observerOptions = {
        threshold: 0.15, // Trigger when 15% of element is visible
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // A. Add 'show' class to fade in the element
                entry.target.classList.add("show");
                
                // B. Trigger Counter Animation (if present in the element)
                if (entry.target.querySelector('.counter')) {
                    startCounters(entry.target);
                }

                // C. Trigger Bar Chart Animation (if present in the element)
                const bars = entry.target.querySelectorAll('.bar');
                if (bars.length > 0) {
                    bars.forEach(bar => {
                        // Read the data-height attribute from HTML
                        const targetHeight = bar.getAttribute('data-height');
                        // Apply it to the style to trigger CSS transition
                        bar.style.height = targetHeight;
                    });
                }
                
                // Stop observing once shown
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    const hiddenElements = document.querySelectorAll(".hidden-el");
    hiddenElements.forEach((el) => observer.observe(el));


    // --- 3. Number Counter Logic ---
    function startCounters(section) {
        const counters = section.querySelectorAll('.counter');
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const duration = 2000; // 2 seconds
            
            // Use startTime to ensure smooth 60fps animation
            const startTime = performance.now();

            const updateCounter = (currentTime) => {
                const elapsedTime = currentTime - startTime;
                const progress = Math.min(elapsedTime / duration, 1); // 0 to 1
                
                // Ease-out function for smoother end
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                const currentVal = Math.ceil(easeOut * target);
                counter.innerText = currentVal;

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.innerText = target;
                }
            };
            requestAnimationFrame(updateCounter);
        });
    }

    // --- 4. Mobile Menu Toggle ---
    const menuIcon = document.querySelector('.mobile-menu-icon');
    const navLinks = document.querySelector('.nav-links');

    if(menuIcon && navLinks) {
        menuIcon.addEventListener('click', () => {
            // Toggles the CSS class defined in style.css
            navLinks.classList.toggle('nav-open');
            
            // Toggle icon between bars and times (X)
            const icon = menuIcon.querySelector('i');
            if(navLinks.classList.contains('nav-open')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-xmark');
            } else {
                icon.classList.remove('fa-xmark');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when a link is clicked
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if(navLinks.classList.contains('nav-open')) {
                    navLinks.classList.remove('nav-open');
                    const icon = menuIcon.querySelector('i');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            });
        });
    }
});