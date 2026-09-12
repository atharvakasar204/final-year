// ============================================================
// TIMELY - SUBSTITUTE FACULTY
// ============================================================

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import { renderNavigation } from "./layout.js";


// ============================================================
// PERIOD TIMINGS
// ============================================================

const PERIOD_TIME = {
  P1: "10:30 – 11:30",
  P2: "11:30 – 12:30",
  P3: "12:30 – 1:30",
  P4: "2:15 – 3:15",
  P5: "3:30 – 4:30",
  P6: "4:30 – 5:30"
};


// ============================================================
// DATA
// ============================================================

let facultyList = [];
let timetableList = [];


// Faculty assigned as substitute during this session
const temporaryAssignments = new Set();


// ============================================================
// INITIALIZE
// ============================================================

async function init() {

  try {

    renderNavigation();

    await requireAuthenticatedUser();

    const protectedContent =
      document.getElementById("protectedContent");

    if (protectedContent) {
      protectedContent.hidden = false;
    }

    enableSignOut();

    await loadData();

    setupFindButton();

  } catch (error) {

    console.error(
      "Substitute page error:",
      error
    );

  }

}


// ============================================================
// LOAD FACULTY + TIMETABLES
// ============================================================

async function loadData() {

  try {

    // ----------------------------------------------
    // FACULTY
    // ----------------------------------------------

    const facultySnapshot =
      await getDocs(
        collection(db, "faculty")
      );

    facultyList = facultySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(
        faculty => faculty.active !== false
      );


    facultyList.sort(
      (a, b) =>
        String(a.name || "").localeCompare(
          String(b.name || "")
        )
    );


    // ----------------------------------------------
    // TIMETABLES
    // ----------------------------------------------

    const timetableSnapshot =
      await getDocs(
        collection(db, "timetables")
      );

    timetableList =
      timetableSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));


    // ----------------------------------------------
    // ABSENT FACULTY DROPDOWN
    // ----------------------------------------------

    const select =
      document.getElementById(
        "absentFaculty"
      );

    if (!select) {
      console.error(
        "absentFaculty dropdown not found"
      );
      return;
    }


    select.innerHTML = `
      <option value="">
        Select faculty
      </option>
    `;


    facultyList.forEach(faculty => {

      const option =
        document.createElement("option");

      option.value =
        faculty.id;

      option.textContent =
        faculty.name;

      select.appendChild(option);

    });


    console.log(
      "Faculty loaded:",
      facultyList
    );

    console.log(
      "Timetables loaded:",
      timetableList
    );


  } catch (error) {

    console.error(
      "Error loading data:",
      error
    );

    showMessage(
      "Unable to load faculty/timetable data.",
      "error"
    );

  }

}


// ============================================================
// FIND BUTTON
// ============================================================

function setupFindButton() {

  const button =
    document.getElementById(
      "findClassesButton"
    );


  if (!button) {

    console.error(
      "Find Classes button not found"
    );

    return;

  }


  button.addEventListener(
    "click",
    function (event) {

      event.preventDefault();

      findClasses();

    }
  );

}


// ============================================================
// FIND CLASSES OF ABSENT FACULTY
// ============================================================

function findClasses() {

  const absentFacultyId =
    document.getElementById(
      "absentFaculty"
    ).value;


  const day =
    document.getElementById(
      "day"
    ).value;


  if (!absentFacultyId) {

    showMessage(
      "Please select absent faculty.",
      "error"
    );

    return;

  }


  if (!day) {

    showMessage(
      "Please select a day.",
      "error"
    );

    return;

  }


  const absentFaculty =
    facultyList.find(
      faculty =>
        faculty.id ===
        absentFacultyId
    );


  if (!absentFaculty) {

    showMessage(
      "Faculty not found.",
      "error"
    );

    return;

  }


  // ----------------------------------------------------------
  // FIND ALL CLASSES
  // ----------------------------------------------------------

  const classes = [];


  timetableList.forEach(
    timetable => {

      const entries =
        Array.isArray(
          timetable.entries
        )
          ? timetable.entries
          : [];


      entries.forEach(
        entry => {

          // Day must match

          if (
            normalize(entry.day) !==
            normalize(day)
          ) {
            return;
          }


          // Faculty must match

          const sameId =
            entry.facultyId &&
            entry.facultyId ===
            absentFaculty.id;


          const sameName =
            entry.facultyName &&
            normalize(entry.facultyName) ===
            normalize(absentFaculty.name);


          if (
            !sameId &&
            !sameName
          ) {
            return;
          }


          classes.push({

            timetable:
              timetable,

            entry:
              entry

          });

        }
      );

    }
  );


  // ----------------------------------------------------------
  // SORT BY PERIOD
  // ----------------------------------------------------------

  classes.sort(
    (a, b) => {

      const p1 =
        getPeriods(a.entry)[0] ||
        "";

      const p2 =
        getPeriods(b.entry)[0] ||
        "";

      return periodNumber(p1) -
             periodNumber(p2);

    }
  );


  console.log(
    "Classes found:",
    classes
  );


  displayClasses(
    classes,
    absentFaculty,
    day
  );

}


// ============================================================
// DISPLAY CLASSES
// ============================================================

function displayClasses(
  classes,
  absentFaculty,
  day
) {

  const classList =
    document.getElementById(
      "classList"
    );


  const classSummary =
    document.getElementById(
      "classSummary"
    );


  if (!classList) {

    console.error(
      "classList not found"
    );

    return;

  }


  classList.innerHTML = "";


  // ----------------------------------------------------------
  // NO CLASSES
  // ----------------------------------------------------------

  if (classes.length === 0) {

    classSummary.textContent =
      `${absentFaculty.name} has no classes on ${day}.`;


    classList.innerHTML = `
      <div class="empty-state">
        No classes found for
        <strong>${escapeHtml(absentFaculty.name)}</strong>
        on
        <strong>${escapeHtml(day)}</strong>.
      </div>
    `;


    showMessage(
      "No classes found.",
      "error"
    );


    return;

  }


  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  classSummary.textContent =
    `${absentFaculty.name} has ${classes.length} class${classes.length === 1 ? "" : "es"} on ${day}.`;


  showMessage(
    `${classes.length} class${classes.length === 1 ? "" : "es"} found.`,
    "success"
  );


  // ----------------------------------------------------------
  // EACH CLASS
  // ----------------------------------------------------------

  classes.forEach(
    (item, index) => {

      createClassCard(
        item,
        index,
        absentFaculty,
        classList
      );

    }
  );

}


// ============================================================
// CREATE ONE CLASS CARD
// ============================================================

function createClassCard(
  item,
  index,
  absentFaculty,
  classList
) {

  const timetable =
    item.timetable;

  const entry =
    item.entry;


  const periods =
    getPeriods(entry);


  const subject =
    entry.subjectName ||
    "Unknown Subject";


  const room =
    entry.roomName ||
    "Room not assigned";


  const type =
    entry.type ||
    "Lecture";


  const time =
    getTime(periods);


  const batches =
    getBatches(entry);


  // ----------------------------------------------------------
  // CARD
  // ----------------------------------------------------------

  const card =
    document.createElement("div");


  card.className =
    "dashboard-card";


  card.style.padding =
    "24px";


  card.style.marginBottom =
    "20px";


  // ----------------------------------------------------------
  // CLASS INFORMATION
  // ----------------------------------------------------------

  card.innerHTML = `

    <div class="card-heading">

      <div>

        <p class="section-label">
          Class ${index + 1}
        </p>

        <h2>
          ${escapeHtml(subject)}
        </h2>

        <p class="page-intro">
          ${escapeHtml(entry.day)}
          •
          ${escapeHtml(periods.join(", "))}
          •
          ${escapeHtml(time)}
        </p>

      </div>

    </div>


    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:16px;
        margin-top:20px;
      "
    >

      <div>
        <small>Type</small>
        <br>
        <strong>
          ${escapeHtml(type)}
        </strong>
      </div>


      <div>
        <small>Room / Lab</small>
        <br>
        <strong>
          ${escapeHtml(room)}
        </strong>
      </div>


      <div>
        <small>Year / Semester</small>
        <br>
        <strong>
          ${escapeHtml(
            String(
              timetable.year || ""
            )
          )}
          /
          Sem
          ${escapeHtml(
            String(
              timetable.semester || ""
            )
          )}
        </strong>
      </div>


      ${
        batches
          ? `
            <div>
              <small>Batch</small>
              <br>
              <strong>
                ${escapeHtml(batches)}
              </strong>
            </div>
          `
          : ""
      }

    </div>

  `;


  // ----------------------------------------------------------
  // FACULTY STATUS
  // ----------------------------------------------------------

  const statusBox =
    createFacultyStatusBox(
      entry,
      absentFaculty
    );


  card.appendChild(
    statusBox
  );


  // ----------------------------------------------------------
  // FREE FACULTY SECTION
  // ----------------------------------------------------------

  const freeSection =
    createFreeFacultySection(
      entry,
      absentFaculty,
      timetable
    );


  card.appendChild(
    freeSection
  );


  // ----------------------------------------------------------
  // ADD CARD
  // ----------------------------------------------------------

  classList.appendChild(
    card
  );

}


// ============================================================
// FACULTY STATUS BOX
// ============================================================

function createFacultyStatusBox(
  entry,
  absentFaculty
) {

  const box =
    document.createElement("div");


  box.style.marginTop =
    "24px";


  box.style.padding =
    "18px";


  box.style.border =
    "1px solid #e5e7eb";


  box.style.borderRadius =
    "12px";


  box.innerHTML = `

    <p class="section-label">
      Faculty Availability
    </p>

    <h3 style="margin:4px 0 14px;">
      Faculty Status for
      ${escapeHtml(
        getPeriods(entry).join(", ")
      )}
    </h3>

  `;


  const list =
    document.createElement("div");


  list.style.display =
    "grid";


  list.style.gap =
    "8px";


  // ----------------------------------------------------------
  // ALL FACULTY
  // ----------------------------------------------------------

  facultyList.forEach(
    faculty => {

      const status =
        getFacultyStatus(
          faculty,
          entry,
          absentFaculty
        );


      const row =
        document.createElement("div");


      row.style.display =
        "flex";


      row.style.justifyContent =
        "space-between";


      row.style.alignItems =
        "center";


      row.style.padding =
        "10px 12px";


      row.style.borderRadius =
        "8px";


      row.style.background =
        "#f8fafc";


      const name =
        document.createElement("span");


      name.textContent =
        faculty.name;


      const statusText =
        document.createElement("span");


      statusText.textContent =
        status.label;


      row.appendChild(
        name
      );


      row.appendChild(
        statusText
      );


      list.appendChild(
        row
      );

    }
  );


  box.appendChild(
    list
  );


  return box;

}


// ============================================================
// FREE FACULTY SECTION
// ============================================================

function createFreeFacultySection(
  entry,
  absentFaculty,
  timetable
) {

  const wrapper =
    document.createElement("div");


  wrapper.style.marginTop =
    "20px";


  const freeFaculty =
    getFreeFaculty(
      entry,
      absentFaculty
    );


  // ----------------------------------------------------------
  // LABEL
  // ----------------------------------------------------------

  const label =
    document.createElement("label");


  label.textContent =
    "Free Faculty";


  label.style.display =
    "block";


  label.style.fontWeight =
    "600";


  label.style.marginBottom =
    "8px";


  wrapper.appendChild(
    label
  );


  // ----------------------------------------------------------
  // DROPDOWN
  // ----------------------------------------------------------

  const select =
    document.createElement("select");


  select.className =
    "form-field-input free-faculty-select";


  select.style.width =
    "100%";


  const defaultOption =
    document.createElement("option");


  defaultOption.value =
    "";


  defaultOption.textContent =
    freeFaculty.length > 0
      ? "Select free faculty"
      : "No free faculty available";


  select.appendChild(
    defaultOption
  );


  /*
    IMPORTANT:

    ONLY FREE FACULTY ARE ADDED.

    Busy / absent / unavailable faculty
    are NOT added here.
  */

  freeFaculty.forEach(
    faculty => {

      const option =
        document.createElement("option");


      option.value =
        faculty.id;


      option.textContent =
        faculty.name;


      select.appendChild(
        option
      );

    }
  );


  wrapper.appendChild(
    select
  );


  // ----------------------------------------------------------
  // BUTTONS
  // ----------------------------------------------------------

  const buttons =
    document.createElement("div");


  buttons.style.display =
    "flex";


  buttons.style.gap =
    "10px";


  buttons.style.marginTop =
    "14px";


  buttons.style.flexWrap =
    "wrap";


  // RANDOM

  const randomButton =
    document.createElement("button");


  randomButton.type =
    "button";


  randomButton.className =
    "outline-button";


  randomButton.textContent =
    "🎲 Random Free Faculty";


  // ASSIGN

  const assignButton =
    document.createElement("button");


  assignButton.type =
    "button";


  assignButton.className =
    "primary-button";


  assignButton.textContent =
    "Assign Substitute";


  buttons.appendChild(
    randomButton
  );


  buttons.appendChild(
    assignButton
  );


  wrapper.appendChild(
    buttons
  );


  // ----------------------------------------------------------
  // RANDOM BUTTON
  // ----------------------------------------------------------

  randomButton.addEventListener(
    "click",
    () => {

      const currentFree =
        getFreeFaculty(
          entry,
          absentFaculty
        );


      if (
        currentFree.length ===
        0
      ) {

        showMessage(
          "No free faculty available for this class.",
          "error"
        );

        return;

      }


      const randomIndex =
        Math.floor(
          Math.random() *
          currentFree.length
        );


      const selected =
        currentFree[
          randomIndex
        ];


      select.value =
        selected.id;

    }
  );


  // ----------------------------------------------------------
  // ASSIGN BUTTON
  // ----------------------------------------------------------

  assignButton.addEventListener(
    "click",
    async () => {

      const selectedId =
        select.value;


      if (!selectedId) {

        showMessage(
          "Please select a free faculty member.",
          "error"
        );

        return;

      }


      const substitute =
        facultyList.find(
          faculty =>
            faculty.id ===
            selectedId
        );


      if (!substitute) {

        showMessage(
          "Faculty not found.",
          "error"
        );

        return;

      }


      // --------------------------------------------
      // FINAL CHECK
      // --------------------------------------------

      const status =
        getFacultyStatus(
          substitute,
          entry,
          absentFaculty
        );


      if (
        status.type !==
        "free"
      ) {

        showMessage(
          `${substitute.name} is no longer free.`,
          "error"
        );

        return;

      }


      assignButton.disabled =
        true;


      randomButton.disabled =
        true;


      select.disabled =
        true;


      try {

        // ------------------------------------------
        // SAVE
        // ------------------------------------------

        await addDoc(
          collection(
            db,
            "substitutions"
          ),
          {

            academicYear:
              document.getElementById(
                "academicYear"
              )?.value || "",

            year:
              timetable.year ||
              "",

            semester:
              timetable.semester ||
              "",

            timetableId:
              timetable.id,

            day:
              entry.day,

            periods:
              getPeriods(entry),

            subjectId:
              entry.subjectId ||
              "",

            subjectName:
              entry.subjectName ||
              "",

            type:
              entry.type ||
              "Lecture",

            roomId:
              entry.roomId ||
              "",

            roomName:
              entry.roomName ||
              "",

            batches:
              Array.isArray(
                entry.batches
              )
                ? entry.batches
                : [],

            absentFacultyId:
              absentFaculty.id,

            absentFacultyName:
              absentFaculty.name,

            substituteFacultyId:
              substitute.id,

            substituteFacultyName:
              substitute.name,

            status:
              "assigned",

            createdAt:
              serverTimestamp()

          }
        );


        // ------------------------------------------
        // MARK SUBSTITUTE BUSY
        // ------------------------------------------

        getPeriods(entry).forEach(
          period => {

            temporaryAssignments.add(
              makeKey(
                substitute.id,
                entry.day,
                period
              )
            );

          }
        );


        // ------------------------------------------
        // SUCCESS
        // ------------------------------------------

        assignButton.textContent =
          "✓ Assigned";


        showMessage(
          `${substitute.name} assigned for ${entry.subjectName}.`,
          "success"
        );


        // Update all status displays on page

        updateAllStatuses();


      } catch (error) {

        console.error(
          "Assign substitute error:",
          error
        );


        showMessage(
          "Unable to assign substitute: " +
          error.message,
          "error"
        );


        assignButton.disabled =
          false;


        randomButton.disabled =
          false;


        select.disabled =
          false;

      }

    }
  );


  return wrapper;

}


// ============================================================
// GET FACULTY STATUS
// ============================================================

function getFacultyStatus(
  faculty,
  entry,
  absentFaculty
) {

  const periods =
    getPeriods(entry);


  // ----------------------------------------------------------
  // ABSENT
  // ----------------------------------------------------------

  if (
    faculty.id ===
    absentFaculty.id
  ) {

    return {

      type:
        "absent",

      label:
        "❌ Absent"

    };

  }


  // ----------------------------------------------------------
  // DAY AVAILABILITY
  // ----------------------------------------------------------

  if (
    !isAvailableOnDay(
      faculty,
      entry.day
    )
  ) {

    return {

      type:
        "unavailable",

      label:
        "❌ Not available"

    };

  }


  // ----------------------------------------------------------
  // TEMPORARY ASSIGNMENT
  // ----------------------------------------------------------

  if (
    periods.some(
      period =>
        temporaryAssignments.has(
          makeKey(
            faculty.id,
            entry.day,
            period
          )
        )
    )
  ) {

    return {

      type:
        "assigned",

      label:
        "❌ Already assigned"

    };

  }


  // ----------------------------------------------------------
  // TIMETABLE BUSY
  // ----------------------------------------------------------

  if (
    isFacultyBusy(
      faculty,
      entry.day,
      periods
    )
  ) {

    return {

      type:
        "busy",

      label:
        "❌ Busy"

    };

  }


  // ----------------------------------------------------------
  // FREE
  // ----------------------------------------------------------

  return {

    type:
      "free",

    label:
      "✅ Free"

  };

}


// ============================================================
// GET FREE FACULTY
// ============================================================

function getFreeFaculty(
  entry,
  absentFaculty
) {

  return facultyList.filter(
    faculty => {

      const status =
        getFacultyStatus(
          faculty,
          entry,
          absentFaculty
        );


      /*
        ONLY FREE TEACHERS.
      */

      return (
        status.type ===
        "free"
      );

    }
  );

}


// ============================================================
// CHECK BUSY
// ============================================================

function isFacultyBusy(
  faculty,
  day,
  periods
) {

  for (
    const timetable of timetableList
  ) {

    const entries =
      Array.isArray(
        timetable.entries
      )
        ? timetable.entries
        : [];


    for (
      const entry of entries
    ) {

      // Day

      if (
        normalize(entry.day) !==
        normalize(day)
      ) {

        continue;

      }


      // Faculty

      const sameId =
        entry.facultyId &&
        entry.facultyId ===
        faculty.id;


      const sameName =
        entry.facultyName &&
        normalize(entry.facultyName) ===
        normalize(faculty.name);


      if (
        !sameId &&
        !sameName
      ) {

        continue;

      }


      // Periods

      const entryPeriods =
        getPeriods(entry);


      /*
        ANY overlapping period means busy.

        For P5-P6 lab:
        faculty must be free in BOTH P5 and P6.
      */

      if (
        periods.some(
          period =>
            entryPeriods.includes(
              period
            )
        )
      ) {

        return true;

      }

    }

  }


  return false;

}


// ============================================================
// DAY AVAILABILITY
// ============================================================

function isAvailableOnDay(
  faculty,
  day
) {

  if (
    !Array.isArray(
      faculty.availableDays
    )
  ) {

    return true;

  }


  if (
    faculty.availableDays.length ===
    0
  ) {

    return true;

  }


  return faculty.availableDays.some(
    availableDay =>
      normalize(availableDay) ===
      normalize(day)
  );

}


// ============================================================
// GET PERIODS
// ============================================================

function getPeriods(
  entry
) {

  if (
    Array.isArray(
      entry.periods
    )
  ) {

    return entry.periods;

  }


  if (
    entry.period
  ) {

    return [
      entry.period
    ];

  }


  return [];

}


// ============================================================
// GET TIME
// ============================================================

function getTime(
  periods
) {

  if (
    periods.length ===
    0
  ) {

    return "";

  }


  const first =
    PERIOD_TIME[
      periods[0]
    ];


  const last =
    PERIOD_TIME[
      periods[
        periods.length - 1
      ]
    ];


  if (
    !first ||
    !last
  ) {

    return "";

  }


  const start =
    first.split(
      " – "
    )[0];


  const end =
    last.split(
      " – "
    )[1];


  return `${start} – ${end}`;

}


// ============================================================
// GET BATCH
// ============================================================

function getBatches(
  entry
) {

  if (
    Array.isArray(
      entry.batches
    ) &&
    entry.batches.length
  ) {

    return entry.batches.join(
      ", "
    );

  }


  if (
    entry.batch
  ) {

    return entry.batch;

  }


  return "";

}


// ============================================================
// PERIOD NUMBER
// ============================================================

function periodNumber(
  period
) {

  const number =
    parseInt(
      String(period)
        .replace(
          "P",
          ""
        )
    );


  return isNaN(number)
    ? 99
    : number;

}


// ============================================================
// TEMPORARY KEY
// ============================================================

function makeKey(
  facultyId,
  day,
  period
) {

  return (
    `${facultyId}_${day}_${period}`
  );

}


// ============================================================
// UPDATE STATUS
// ============================================================

function updateAllStatuses() {

  /*
    We simply show a message after assignment.

    The next Find Classes click will rebuild
    every card with the updated availability.
  */

  console.log(
    "Faculty availability updated."
  );

}


// ============================================================
// NORMALIZE
// ============================================================

function normalize(
  value
) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase();

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
  message,
  type
) {

  const element =
    document.getElementById(
      "substituteMessage"
    );


  if (!element) {
    return;
  }


  element.textContent =
    message || "";


  element.className =
    "form-message";


  if (type) {

    element.classList.add(
      type
    );

  }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
  value
) {

  return String(
    value ?? ""
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


// ============================================================
// START
// ============================================================

init();