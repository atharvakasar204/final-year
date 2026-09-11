import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import {
  renderNavigation
} from "./layout.js";


// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const DAYS = [

  "Monday",

  "Tuesday",

  "Wednesday",

  "Thursday",

  "Friday",

  "Saturday"

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


  const protectedContent =
    document.querySelector(
      "#protectedContent"
    );


  if (
    protectedContent
  ) {

    protectedContent.removeAttribute(
      "hidden"
    );

  }


  enableSignOut();


  setupEvents();


  await loadTimetable();

}


// --------------------------------------------------
// EVENTS
// --------------------------------------------------

function setupEvents() {

  const academicYear =
    document.querySelector(
      "#academicYear"
    );


  const semester =
    document.querySelector(
      "#semester"
    );


  const refreshButton =
    document.querySelector(
      "#refreshTimetableButton"
    );


  const printButton =
    document.querySelector(
      "#printTimetableButton"
    );


  academicYear?.addEventListener(
    "change",
    loadTimetable
  );


  semester?.addEventListener(
    "change",
    loadTimetable
  );


  refreshButton?.addEventListener(
    "click",
    loadTimetable
  );


  printButton?.addEventListener(
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


  if (
    message
  ) {

    message.textContent =
      "";

    message.className =
      "form-message";

  }


  if (
    container
  ) {

    container.innerHTML = `

      <div class="empty-state">

        Loading timetable...

      </div>

    `;

  }


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


    if (
      !snapshot.exists()
    ) {

      if (
        container
      ) {

        container.innerHTML = `

          <div class="empty-state">

            No timetable has been generated for
            ${escapeHtml(year)},
            Semester
            ${semester}.

          </div>

        `;

      }


      updateStatistics(
        []
      );


      updateTitles(
        year,
        semester,
        0
      );


      return;

    }


    const data =
      snapshot.data();


    const entries =
      Array.isArray(
        data.entries
      )
        ? data.entries
        : [];


    renderTimetable(

      entries,

      data.workingDays

    );


    updateStatistics(
      entries
    );


    updateTitles(

      year,

      semester,

      entries.length

    );


    if (
      message
    ) {

      message.textContent =
        "Timetable loaded successfully.";

      message.className =
        "form-message success";

    }


  } catch (
    error
  ) {

    console.error(
      "Timetable loading error:",
      error
    );


    if (
      container
    ) {

      container.innerHTML = `

        <div class="empty-state">

          Unable to load timetable.

        </div>

      `;

    }


    if (
      message
    ) {

      message.textContent =
        error.message ||
        "Unable to load timetable.";

      message.className =
        "form-message error";

    }

  }

}


// --------------------------------------------------
// UPDATE TITLES
// --------------------------------------------------

function updateTitles(
  year,
  semester,
  count
) {

  const title =
    document.querySelector(
      "#timetableTitle"
    );


  const subtitle =
    document.querySelector(
      "#timetableSubtitle"
    );


  const printTitle =
    document.querySelector(
      "#printTitle"
    );


  const printSubtitle =
    document.querySelector(
      "#printSubtitle"
    );


  const yearLabel =
    getYearLabel(
      year
    );


  const titleText =
    `${yearLabel} — Semester ${semester}`;


  if (
    title
  ) {

    title.textContent =
      titleText;

  }


  if (
    subtitle
  ) {

    subtitle.textContent =

      count > 0

        ? `${count} scheduled teaching blocks`

        : "No generated timetable found.";

  }


  if (
    printTitle
  ) {

    printTitle.textContent =
      `TIMELY — ${yearLabel} — Semester ${semester}`;

  }


  if (
    printSubtitle
  ) {

    printSubtitle.textContent =
      count > 0

        ? "Weekly Timetable"

        : "No generated timetable";

  }

}


// --------------------------------------------------
// YEAR LABEL
// --------------------------------------------------

function getYearLabel(
  year
) {

  const labels = {

    SE:
      "Second Year (SE)",

    TE:
      "Third Year (TE)",

    BE:
      "Final Year (BE)"

  };


  return (
    labels[year] ||
    year
  );

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


  if (
    !container
  ) {

    return;

  }


  /*
   * Use Firestore workingDays when available.
   *
   * Otherwise Monday-Saturday.
   */

  const days =

    Array.isArray(
      workingDays
    ) &&
    workingDays.length > 0

      ? workingDays

      : DAYS;


  if (
    entries.length === 0
  ) {

    container.innerHTML = `

      <div class="empty-state">

        No classes are scheduled.

      </div>

    `;

    return;

  }


  // ------------------------------------------------
  // CREATE LOOKUP
  // ------------------------------------------------

  const entryMap =
    new Map();


  entries.forEach(
    entry => {

      if (
        !entry.day ||
        !Array.isArray(
          entry.periods
        )
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

    }
  );


  // ------------------------------------------------
  // TABLE HEADER
  // ------------------------------------------------

  let html = `

    <table
      class="data-table timetable-grid"
      style="
        min-width:1100px;
        width:100%;
      "
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


  PERIODS.forEach(
    period => {

      html += `

        <th
          style="
            min-width:165px;
            text-align:center;
          "
        >

          <strong>
            ${escapeHtml(
              period.label
            )}
          </strong>

          <br>

          <small>
            ${escapeHtml(
              period.time
            )}
          </small>

        </th>

      `;

    }
  );


  html += `

        </tr>

      </thead>

      <tbody>

  `;


  // ------------------------------------------------
  // DAYS
  // ------------------------------------------------

  days.forEach(
    day => {

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

            ${escapeHtml(
              day
            )}

          </td>

      `;


      // ----------------------------------------------
      // PERIODS
      // ----------------------------------------------

      PERIODS.forEach(
        period => {

          const key =
            `${day}_${period.id}`;


          const entry =
            entryMap.get(
              key
            );


          // --------------------------------------------
          // EMPTY PERIOD
          // --------------------------------------------

          if (
            !entry
          ) {

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


          // --------------------------------------------
          // MULTI-PERIOD ENTRY
          // --------------------------------------------

          const firstPeriod =
            Array.isArray(
              entry.periods
            )
              ? entry.periods[0]
              : period.id;


          const isSecondLabPeriod =

            Array.isArray(
              entry.periods
            ) &&

            entry.periods.length > 1 &&

            period.id !== firstPeriod;


          /*
           * Show "continues" for second period
           * of a multi-period block.
           */

          if (
            isSecondLabPeriod
          ) {

            html += `

              <td
                style="
                  text-align:center;
                  background:#f8fafc;
                  color:#64748b;
                "
              >

                ${escapeHtml(
                  getContinuationText(
                    entry
                  )
                )}

              </td>

            `;

            return;

          }


          // --------------------------------------------
          // TYPE
          // --------------------------------------------

          const typeLabel =
            getTypeLabel(
              entry.type
            );


          // --------------------------------------------
          // ROOM
          // --------------------------------------------

          const roomLabel =
            entry.roomName ||
            "Room not assigned";


          // --------------------------------------------
          // FACULTY
          // --------------------------------------------

          const facultyLabel =
            entry.facultyName ||
            "Faculty not assigned";


          // --------------------------------------------
          // BATCH
          // --------------------------------------------

          let batchHtml =
            "";


          if (

            Array.isArray(
              entry.batches
            )

            &&

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
                  entry.batches.join(
                    ", "
                  )
                )}

              </div>

            `;

          }


          // --------------------------------------------
          // SUBJECT CODE
          // --------------------------------------------

          let codeHtml =
            "";


          if (
            entry.subjectCode
          ) {

            codeHtml = `

              <div
                style="
                  margin-top:4px;
                  font-size:11px;
                "
              >

                ${escapeHtml(
                  entry.subjectCode
                )}

              </div>

            `;

          }


          // --------------------------------------------
          // CELL
          // --------------------------------------------

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

                ${escapeHtml(
                  typeLabel
                )}

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


              ${codeHtml}


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

        }
      );


      html += `

        </tr>

      `;

    }
  );


  html += `

      </tbody>

    </table>

  `;


  container.innerHTML =
    html;

}


// --------------------------------------------------
// TYPE LABEL
// --------------------------------------------------

function getTypeLabel(
  type
) {

  const normalized =
    String(
      type ||
      ""
    )
      .toLowerCase()
      .trim();


  if (
    normalized ===
    "lab"
  ) {

    return "LAB";

  }


  if (
    normalized ===
    "tutorial"
  ) {

    return "TUTORIAL";

  }


  if (
    normalized ===
    "seminar"
  ) {

    return "SEMINAR";

  }


  if (
    normalized ===
    "project"
  ) {

    return "PROJECT";

  }


  return "LECTURE";

}


// --------------------------------------------------
// CONTINUATION TEXT
// --------------------------------------------------

function getContinuationText(
  entry
) {

  const normalized =
    String(
      entry.type ||
      ""
    )
      .toLowerCase()
      .trim();


  if (
    normalized ===
    "lab"
  ) {

    return "Lab continues";

  }


  if (
    normalized ===
    "project"
  ) {

    return "Project continues";

  }


  if (
    normalized ===
    "seminar"
  ) {

    return "Seminar continues";

  }


  return "Continues";

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
        entry.type ===
        "lecture"
    );


  const tutorials =
    entries.filter(
      entry =>
        entry.type ===
        "tutorial"
    );


  const labs =
    entries.filter(
      entry =>
        entry.type ===
        "lab"
    );


  const projects =
    entries.filter(
      entry =>
        entry.type ===
        "project"
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

    labs.length +
    projects.length;

}


// --------------------------------------------------
// PRINT
// --------------------------------------------------

function printTimetable() {

  const container =
    document.querySelector(
      "#timetableContainer"
    );


  if (
    !container
  ) {

    return;

  }


  const table =
    container.querySelector(
      "table"
    );


  if (
    !table
  ) {

    const message =
      document.querySelector(
        "#timetableMessage"
      );


    if (
      message
    ) {

      message.textContent =
        "There is no timetable to print.";

      message.className =
        "form-message error";

    }


    return;

  }


  /*
   * Browser print dialog.
   *
   * The @media print CSS in timetable.html
   * hides everything except #printTimetableArea.
   */

  window.print();

}


// --------------------------------------------------
// ESCAPE HTML
// --------------------------------------------------

function escapeHtml(
  value
) {

  return String(
    value ??
    ""
  )

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

initialisePage()
  .catch(
    error => {

      if (
        error.message !==
        "Firebase has not been configured."
      ) {

        console.error(
          "Timetable page error:",
          error
        );

      }

    }
  );