const navigationItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "dashboard.html",
    icon: "grid"
  },

  {
    id: "faculty",
    label: "Faculty",
    href: "faculty.html",
    icon: "people"
  },

  {
    id: "faculty-assignments",
    label: "Subject Assignment",
    href: "faculty-assignments.html",
    icon: "assignment"
  },

  {
    id: "subjects",
    label: "Subjects",
    href: "subjects.html",
    icon: "book"
  },

  {
    id: "rooms",
    label: "Rooms & Labs",
    href: "rooms-labs.html",
    icon: "door"
  },

  {
    id: "generator",
    label: "Timetable Generator",
    href: "generator.html",
    icon: "spark"
  },

  {
    id: "timetable",
    label: "Timetable",
    href: "timetable.html",
    icon: "calendar"
  },

  {
    id: "substitute",
    label: "Substitute Faculty",
    href: "substitute.html",
    icon: "switch"
  }
];


const icons = {

  grid:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><rect x="14" y="14" width="6.5" height="6.5" rx="1"/></svg>',

  people:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.55-3.4 2.35-5.1 5.5-5.1s4.95 1.7 5.5 5.1M16.5 5.5a2.8 2.8 0 0 1 0 5.25M17 15a4.5 4.5 0 0 1 3.5 2.15"/></svg>',

  assignment:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',

  book:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.6A2.6 2.6 0 0 1 6.6 3H20v16.5H6.6A2.6 2.6 0 0 0 4 22V5.6Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M8 7h8"/></svg>',

  door:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 21V4.8A1.8 1.8 0 0 1 6.8 3h10.4A1.8 1.8 0 0 1 19 4.8V21M3 21h18M9 12h.01"/></svg>',

  spark:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3-1.3 5.4L6 10l4.7 1.6L12 17l1.3-5.4L18 10l-4.7-1.6L12 3ZM5.5 16l-.55 2.45L2.5 19l2.45.55L5.5 22l.55-2.45L8.5 19l-2.45-.55L5.5 16ZM19 15l-.55 2.45L16 18l2.45.55L19 21l.55-2.45L22 18l-2.45-.55L19 15Z"/></svg>',

  calendar:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7.5 2.5v4M16.5 2.5v4M3 9h18M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 17h.01M12 17h.01"/></svg>',

  switch:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7h12M15 3l4 4-4 4M17 17H5M9 13l-4 4 4 4"/></svg>'
};


export function renderNavigation() {

  const sidebar =
    document.querySelector("#appSidebar");

  if (!sidebar) return;


  const currentPage =
    document.body.dataset.page;


  const navMarkup =
    navigationItems
      .map(item => `

        <a
          class="nav-link${
            item.id === currentPage
              ? " is-active"
              : ""
          }"
          href="${item.href}"
          ${
            item.id === currentPage
              ? 'aria-current="page"'
              : ""
          }
        >

          ${icons[item.icon]}

          <span>
            ${item.label}
          </span>

        </a>

      `)
      .join("");


  sidebar.innerHTML = `

    <a
      class="app-brand"
      href="dashboard.html"
      aria-label="Timely dashboard"
    >

      <span
        class="brand-mark"
        aria-hidden="true"
      >

        <svg
          viewBox="0 0 32 32"
          fill="none"
        >

          <path
            d="M7 5.5h18M7 26.5h18M8.5 5.5v21M23.5 5.5v21M8.5 11h15M8.5 17h15M14 11v15M19 11v15"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

        </svg>

      </span>

      <span>
        Timely
      </span>

    </a>


    <nav
      class="app-nav"
      aria-label="Main navigation"
    >

      ${navMarkup}

    </nav>


    <div class="sidebar-bottom">

      <button
        class="sign-out"
        type="button"
        data-sign-out
      >

        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >

          <path
            d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"
          />

        </svg>

        <span>
          Sign out
        </span>

      </button>

    </div>

  `;
}