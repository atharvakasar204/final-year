import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import { renderNavigation } from "./layout.js";


// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday"
];


const PERIODS = [
  {
    id: "P1",
    label: "P1",
    time: "10:30 – 11:30"
  },
  {
    id: "P2",
    label: "P2",
    time: "11:30 – 12:30"
  },
  {
    id: "P3",
    label: "P3",
    time: "12:30 – 1:30"
  },
  {
    id: "P4",
    label: "P4",
    time: "2:15 – 3:15"
  },
  {
    id: "P5",
    label: "P5",
    time: "3:30 – 4:30"
  },
  {
    id: "P6",
    label: "P6",
    time: "4:30 – 5:30"
  }
];


// --------------------------------------------------
// INITIALISE
// --------------------------------------------------

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  document
    .querySelector("#protectedContent")
    .removeAttribute("hidden");

  enableSignOut();

  setupEvents();

  await loadTimetable();
}


// --------------------------------------------------
// EVENTS
// --------------------------------------------------

function setupEvents() {

  document
    .querySelector("#academicYear")
    .addEventListener(
      "change",
      loadTimetable
    );


  document
    .querySelector("#semester")
    .addEventListener(
      "change",
      loadTimetable
    );


  document
    .querySelector("#refreshTimetableButton")
    .addEventListener(
      "click",
      loadTimetable
    );


  document
    .querySelector("#printTimetableButton")
    .addEventListener(
      "click",
      printTimetable
    );
}


// --------------------------------------------------
// LOAD TIMETABLE
// --------------------------------------------------

async function loadTimetable() {

  const year =
    document.querySelector(
      "#academicYear"
    ).value;


  const semester =
    Number(
      document.querySelector(
        "#semester"
      ).value
    );


  const container =
    document.querySelector(
      "#timetableContainer"
    );


  const message =
    document.querySelector(
      "#timetableMessage"
    );


  message.textContent = "";
  message.className =
    "form-message";


  container.innerHTML = `
    <div class="empty-state">
      Loading timetable...
    </div>
  `;


  try {

    const timetableRef =
      doc(
        db,
        "timetables",
        `${year}_${semester}`
      );


    const snapshot =
      await getDoc(
        timetableRef
      );


    if (!snapshot.exists()) {

      container.innerHTML = `
        <div class="empty-state">
          No timetable has been generated for
          ${year}, Semester ${semester}.
        </div>
      `;


      updateStatistics([]);

      document.querySelector(
        "#timetableTitle"
      ).textContent =
        `${year} — Semester ${semester}`;


      document.querySelector(
        "#timetableSubtitle"
      ).textContent =
        "No generated timetable found.";


      return;
    }


    const data =
      snapshot.data();


    const entries =
      Array.isArray(data.entries)
        ? data.entries
        : [];


    renderTimetable(
      entries,
      data.workingDays
    );


    updateStatistics(
      entries
    );


    document.querySelector(
      "#timetableTitle"
    ).textContent =
      `${year} — Semester ${semester}`;


    document.querySelector(
      "#timetableSubtitle"
    ).textContent =
      `${entries.length} scheduled teaching blocks`;


    message.textContent =
      "Timetable loaded successfully.";

    message.className =
      "form-message success";


  } catch (error) {

    console.error(
      "Timetable loading error:",
      error
    );


    container.innerHTML = `
      <div class="empty-state">
        Unable to load timetable.
      </div>
    `;


    message.textContent =
      error.message ||
      "Unable to load timetable.";

    message.className =
      "form-message error";

  }

}


// --------------------------------------------------
// RENDER TIMETABLE
// --------------------------------------------------

function renderTimetable(
  entries,
  workingDays
) {

  const container =
    document.querySelector(
      "#timetableContainer"
    );


  const days =
    Array.isArray(workingDays) &&
    workingDays.length > 0
      ? workingDays
      : DAYS;


  if (entries.length === 0) {

    container.innerHTML = `
      <div class="empty-state">
        No classes are scheduled.
      </div>
    `;

    return;
  }


  // ----------------------------------------------
  // CREATE LOOKUP
  // ----------------------------------------------

  const entryMap =
    new Map();


  entries.forEach(entry => {

    if (
      !entry.day ||
      !Array.isArray(entry.periods)
    ) {

      return;

    }


    entry.periods.forEach(
      periodId => {

        const key =
          `${entry.day}_${periodId}`;


        entryMap.set(
          key,
          entry
        );

      }
    );

  });


  // ----------------------------------------------
  // TABLE
  // ----------------------------------------------

  let html = `

    <table
      class="data-table timetable-grid"
      style="min-width:1100px;"
    >

      <thead>

        <tr>

          <th
            style="
              min-width:130px;
              position:sticky;
              left:0;
              background:#fff;
              z-index:2;
            "
          >
            Day
          </th>
  `;


  PERIODS.forEach(period => {

    html += `

      <th
        style="
          min-width:165px;
          text-align:center;
        "
      >

        <strong>
          ${period.label}
        </strong>

        <br>

        <small>
          ${period.time}
        </small>

      </th>

    `;

  });


  html += `

        </tr>

      </thead>

      <tbody>
  `;


  days.forEach(day => {

    html += `

      <tr>

        <td
          style="
            font-weight:700;
            position:sticky;
            left:0;
            background:#fff;
            z-index:1;
          "
        >
          ${escapeHtml(day)}
        </td>

    `;


    PERIODS.forEach(period => {

      const key =
        `${day}_${period.id}`;


      const entry =
        entryMap.get(key);


      if (!entry) {

        html += `

          <td
            style="
              text-align:center;
              color:#9ca3af;
              min-height:100px;
            "
          >
            —
          </td>

        `;

        return;
      }


      // Only display the complete entry in
      // the first period of a multi-period lab.

      const firstPeriod =
        Array.isArray(entry.periods)
          ? entry.periods[0]
          : period.id;


      if (
        entry.type === "lab" &&
        period.id !== firstPeriod
      ) {

        html += `

          <td
            style="
              text-align:center;
              background:#f8fafc;
              color:#64748b;
            "
          >
            Lab continues
          </td>

        `;

        return;
      }


      const typeLabel =
        entry.type === "lab"
          ? "LAB"
          : entry.type === "tutorial"
            ? "TUTORIAL"
            : "LECTURE";


      const roomLabel =
        entry.roomName ||
        "Room not assigned";


      const facultyLabel =
        entry.facultyName ||
        "Faculty not assigned";


      let batchHtml = "";


      if (
        entry.type === "lab" &&
        Array.isArray(entry.batches) &&
        entry.batches.length > 0
      ) {

        batchHtml = `

          <div
            style="
              margin-top:6px;
              font-size:12px;
            "
          >
            Batch:
            ${escapeHtml(
              entry.batches.join(", ")
            )}
          </div>

        `;

      }


      html += `

        <td
          style="
            vertical-align:top;
            min-height:110px;
            padding:14px;
          "
        >

          <div
            style="
              font-size:11px;
              font-weight:700;
              letter-spacing:.04em;
              margin-bottom:7px;
            "
          >
            ${typeLabel}
          </div>


          <div
            style="
              font-weight:700;
              line-height:1.3;
            "
          >
            ${escapeHtml(
              entry.subjectName ||
              "Unknown Subject"
            )}
          </div>


          <div
            style="
              margin-top:8px;
              font-size:13px;
            "
          >
            ${escapeHtml(
              facultyLabel
            )}
          </div>


          <div
            style="
              margin-top:5px;
              font-size:13px;
            "
          >
            ${escapeHtml(
              roomLabel
            )}
          </div>


          ${batchHtml}

        </td>

      `;

    });


    html += `

      </tr>

    `;

  });


  html += `

      </tbody>

    </table>

  `;


  container.innerHTML =
    html;

}


// --------------------------------------------------
// STATISTICS
// --------------------------------------------------

function updateStatistics(
  entries
) {

  const lectures =
    entries.filter(
      entry =>
        entry.type === "lecture"
    );


  const tutorials =
    entries.filter(
      entry =>
        entry.type === "tutorial"
    );


  const labs =
    entries.filter(
      entry =>
        entry.type === "lab"
    );


  document.querySelector(
    "#scheduledCount"
  ).textContent =
    entries.length;


  document.querySelector(
    "#lectureCount"
  ).textContent =
    lectures.length;


  document.querySelector(
    "#tutorialCount"
  ).textContent =
    tutorials.length;


  document.querySelector(
    "#labCount"
  ).textContent =
    labs.length;

}


// --------------------------------------------------
// PRINT
// --------------------------------------------------

function printTimetable() {

  window.print();

}


// --------------------------------------------------
// ESCAPE HTML
// --------------------------------------------------

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


// --------------------------------------------------
// START
// --------------------------------------------------

initialisePage().catch(error => {

  if (
    error.message !==
    "Firebase has not been configured."
  ) {

    console.error(error);

  }

});