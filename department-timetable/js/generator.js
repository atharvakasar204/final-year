// ============================================================
// TIMELY - AUTOMATIC TIMETABLE GENERATOR
// generator.js
// Firebase 12.1.0
//
// Features:
// - Monday-Saturday
// - L/T/P subject hours
// - Elective selection
// - Faculty clash prevention
// - Student/cohort clash prevention
// - Room/lab clash prevention
// - 2-hour laboratory blocks
// - Faculty availability
// - Automatic faculty assignment
// - Saves timetable to Firestore
//
// IMPORTANT:
// Subjects are entered manually in Firestore.
// The generator uses the subjects actually entered.
// It does NOT require an exact hard-coded L/T/P total.
// ============================================================

import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import { renderNavigation } from "./layout.js";


// ============================================================
// CONSTANTS
// ============================================================

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
    time: "10:30 - 11:30"
  },
  {
    id: "P2",
    label: "P2",
    time: "11:30 - 12:30"
  },
  {
    id: "P3",
    label: "P3",
    time: "12:30 - 1:30"
  },
  {
    id: "P4",
    label: "P4",
    time: "2:15 - 3:15"
  },
  {
    id: "P5",
    label: "P5",
    time: "3:30 - 4:30"
  },
  {
    id: "P6",
    label: "P6",
    time: "4:30 - 5:30"
  }
];


// Valid 2-hour lab blocks.
// P4 + P5 is NOT valid because of the tea break.
const LAB_BLOCKS = [
  ["P1", "P2"],
  ["P2", "P3"],
  ["P5", "P6"]
];


// ============================================================
// STATE
// ============================================================

let allSubjects = [];
let allFaculty = [];
let allRooms = [];

let selectedWorkingDays = [...DAYS];


// ============================================================
// INITIALISE PAGE
// ============================================================

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  const protectedContent =
    document.querySelector(
      "#protectedContent"
    );

  if (protectedContent) {
    protectedContent.removeAttribute("hidden");
  }

  enableSignOut();

  setupEvents();

  await loadData();

  updateElectiveUI();

  updateRequirementSummary();

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  document
    .querySelector("#year")
    ?.addEventListener(
      "change",
      () => {

        updateElectiveUI();
        updateRequirementSummary();

      }
    );


  document
    .querySelector("#semester")
    ?.addEventListener(
      "change",
      () => {

        updateElectiveUI();
        updateRequirementSummary();

      }
    );


  document
    .querySelectorAll(".working-day")
    .forEach(
      checkbox => {

        checkbox.addEventListener(
          "change",
          () => {

            updateWorkingDays();

            updateRequirementSummary();

          }
        );

      }
    );


  document
    .querySelector("#electiveList")
    ?.addEventListener(
      "change",
      () => {

        updateRequirementSummary();

      }
    );


  document
    .querySelector("#generateButton")
    ?.addEventListener(
      "click",
      generateTimetable
    );

}


// ============================================================
// LOAD FIRESTORE DATA
// ============================================================

async function loadData() {

  showStatus(
    "Loading faculty, subjects and rooms...",
    "info"
  );


  try {

    const [
      subjectsSnapshot,
      facultySnapshot,
      roomsSnapshot
    ] = await Promise.all([

      getDocs(
        collection(
          db,
          "subjects"
        )
      ),

      getDocs(
        collection(
          db,
          "faculty"
        )
      ),

      getDocs(
        collection(
          db,
          "rooms"
        )
      )

    ]);


    allSubjects =
      subjectsSnapshot.docs.map(
        item => ({
          id: item.id,
          ...item.data()
        })
      );


    allFaculty =
      facultySnapshot.docs.map(
        item => ({
          id: item.id,
          ...item.data()
        })
      )
      .filter(
        faculty =>
          faculty.active !== false
      );


    allRooms =
      roomsSnapshot.docs.map(
        item => ({
          id: item.id,
          ...item.data()
        })
      )
      .filter(
        room =>
          room.status !== "unavailable"
      );


    showStatus(
      "Setup data loaded successfully.",
      "success"
    );


  } catch (error) {

    console.error(
      "Data loading error:",
      error
    );


    showStatus(
      error.message ||
      "Unable to load setup data.",
      "error"
    );

  }

}


// ============================================================
// WORKING DAYS
// ============================================================

function updateWorkingDays() {

  const checked =
    Array.from(
      document.querySelectorAll(
        ".working-day:checked"
      )
    )
    .map(
      checkbox =>
        checkbox.value
    );


  selectedWorkingDays =
    checked.length > 0
      ? checked
      : [...DAYS];

}


// ============================================================
// ELECTIVE UI
// ============================================================

function updateElectiveUI() {

  const year =
    document.querySelector(
      "#year"
    )?.value;


  const semester =
    Number(
      document.querySelector(
        "#semester"
      )?.value
    );


  const section =
    document.querySelector(
      "#electiveSection"
    );


  const list =
    document.querySelector(
      "#electiveList"
    );


  if (!section || !list) {
    return;
  }


  const subjects =
    allSubjects.filter(
      subject =>
        subject.year === year &&
        Number(subject.semester) === semester &&
        subject.active !== false
    );


  const groups = {};


  subjects.forEach(
    subject => {

      if (
        subject.electiveGroup
      ) {

        if (
          !groups[
            subject.electiveGroup
          ]
        ) {

          groups[
            subject.electiveGroup
          ] = [];

        }


        groups[
          subject.electiveGroup
        ].push(subject);

      }

    }
  );


  const groupNames =
    Object.keys(groups);


  if (
    groupNames.length === 0
  ) {

    section.hidden = true;

    list.innerHTML = "";

    return;

  }


  section.hidden = false;


  list.innerHTML =
    groupNames
      .map(
        group => {

          const options =
            groups[group];


          return `
            <div class="elective-group">

              <div class="elective-group-title">
                ${escapeHtml(group)}
              </div>

              <div class="elective-options">

                ${options
                  .map(
                    (subject, index) => {

                      return `
                        <label class="elective-option">

                          <input
                            type="radio"
                            name="elective-${escapeAttribute(group)}"
                            value="${escapeAttribute(subject.id)}"
                            ${index === 0 ? "checked" : ""}
                          >

                          <span>
                            ${escapeHtml(
                              subject.name || ""
                            )}
                          </span>

                        </label>
                      `;

                    }
                  )
                  .join("")}

              </div>

            </div>
          `;

        }
      )
      .join("");

}


// ============================================================
// GET SELECTED ELECTIVES
// ============================================================

function getSelectedElectiveIds() {

  const radios =
    Array.from(
      document.querySelectorAll(
        '#electiveList input[type="radio"]:checked'
      )
    );


  return new Set(
    radios.map(
      radio =>
        radio.value
    )
  );

}


// ============================================================
// GET SCHEDULABLE SUBJECTS
// ============================================================

function getSchedulableSubjects() {

  const year =
    document.querySelector(
      "#year"
    )?.value;


  const semester =
    Number(
      document.querySelector(
        "#semester"
      )?.value
    );


  const selectedElectives =
    getSelectedElectiveIds();


  return allSubjects.filter(
    subject => {

      if (
        subject.year !== year
      ) {

        return false;

      }


      if (
        Number(subject.semester) !== semester
      ) {

        return false;

      }


      if (
        subject.active === false
      ) {

        return false;

      }


      // Elective subject:
      // only selected option is scheduled.
      if (
        subject.electiveGroup
      ) {

        return selectedElectives.has(
          subject.id
        );

      }


      return true;

    }
  );

}


// ============================================================
// CALCULATE LOAD
// ============================================================

function calculateLoad(subjects) {

  let L = 0;
  let T = 0;
  let P = 0;


  subjects.forEach(
    subject => {

      L += Number(
        subject.lectureHours || 0
      );


      T += Number(
        subject.tutorialHours || 0
      );


      P += Number(
        subject.practicalHours || 0
      );

    }
  );


  return {
    L,
    T,
    P,
    total: L + T + P
  };

}


// ============================================================
// UPDATE REQUIREMENT SUMMARY
// ============================================================

function updateRequirementSummary() {

  const subjects =
    getSchedulableSubjects();


  const load =
    calculateLoad(subjects);


  setText(
    "#requiredLectures",
    load.L
  );


  setText(
    "#requiredTutorials",
    load.T
  );


  setText(
    "#requiredPracticals",
    load.P
  );


  setText(
    "#requiredTotal",
    load.total
  );

}


// ============================================================
// GENERATE TIMETABLE
// ============================================================

async function generateTimetable() {

  const button =
    document.querySelector(
      "#generateButton"
    );


  try {

    updateWorkingDays();


    const year =
      document.querySelector(
        "#year"
      )?.value;


    const semester =
      Number(
        document.querySelector(
          "#semester"
        )?.value
      );


    if (!year) {

      throw new Error(
        "Please select an academic year."
      );

    }


    if (!semester) {

      throw new Error(
        "Please select a semester."
      );

    }


    if (
      selectedWorkingDays.length === 0
    ) {

      throw new Error(
        "Select at least one working day."
      );

    }


    const subjects =
      getSchedulableSubjects();


    if (
      subjects.length === 0
    ) {

      throw new Error(
        "No subjects found for the selected year and semester."
      );

    }


    const load =
      calculateLoad(subjects);


    updateRequirementSummary();


    showStatus(
      `Generating timetable for ${year}, Semester ${semester}...`,
      "info"
    );


    if (button) {

      button.disabled = true;

      button.textContent =
        "Generating...";

    }


    // --------------------------------------------------------
    // BUILD TASKS
    // --------------------------------------------------------

    const tasks =
      buildTasks(subjects);


    // --------------------------------------------------------
    // VALIDATE AVAILABLE PERIODS
    // --------------------------------------------------------

    const availablePeriods =
      selectedWorkingDays.length *
      PERIODS.length;


    if (
      load.total > availablePeriods
    ) {

      throw new Error(
        `Required ${load.total} periods, but only ${availablePeriods} periods are available.`
      );

    }


    // --------------------------------------------------------
    // SCHEDULE
    // --------------------------------------------------------

    const schedule =
      createSchedule(
        tasks,
        selectedWorkingDays,
        allFaculty,
        allRooms,
        year,
        semester
      );


    if (!schedule.success) {

      throw new Error(
        schedule.message
      );

    }


    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    const timetableId =
      `${year}_${semester}`;


    await setDoc(

      doc(
        db,
        "timetables",
        timetableId
      ),

      {

        year,

        semester,

        workingDays:
          selectedWorkingDays,

        periods:
          PERIODS,

        load,

        entries:
          schedule.entries,

        generatedAt:
          serverTimestamp()

      }

    );


    showStatus(
      `Timetable generated successfully. ${schedule.entries.length} entries created.`,
      "success"
    );


    renderGenerationResult(
      schedule.entries,
      load
    );


  } catch (error) {

    console.error(
      "Generation error:",
      error
    );


    showStatus(
      error.message ||
      "Unable to generate timetable.",
      "error"
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "Generate Timetable";

    }

  }

}


// ============================================================
// BUILD TASKS
// ============================================================

function buildTasks(subjects) {

  const tasks = [];


  subjects.forEach(
    subject => {

      const lectureHours =
        Number(
          subject.lectureHours || 0
        );


      const tutorialHours =
        Number(
          subject.tutorialHours || 0
        );


      const practicalHours =
        Number(
          subject.practicalHours || 0
        );


      // ------------------------------------------------------
      // LECTURES
      // ------------------------------------------------------

      for (
        let i = 0;
        i < lectureHours;
        i++
      ) {

        tasks.push({

          id:
            `${subject.id}-L-${i}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            subject.semester,

          type:
            "lecture",

          duration:
            1

        });

      }


      // ------------------------------------------------------
      // TUTORIALS
      // ------------------------------------------------------

      for (
        let i = 0;
        i < tutorialHours;
        i++
      ) {

        tasks.push({

          id:
            `${subject.id}-T-${i}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            subject.semester,

          type:
            "tutorial",

          duration:
            1

        });

      }


      // ------------------------------------------------------
      // PRACTICALS
      //
      // Practical hours are scheduled as 2-hour blocks.
      // ------------------------------------------------------

      let remainingPracticalHours =
        practicalHours;


      let labNumber = 1;


      while (
        remainingPracticalHours >= 2
      ) {

        tasks.push({

          id:
            `${subject.id}-P-${labNumber}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            subject.semester,

          type:
            subject.type === "project"
              ? "project"
              : subject.type === "seminar"
                ? "seminar"
                : "lab",

          duration:
            2

        });


        remainingPracticalHours -= 2;

        labNumber++;

      }


      // Handle unusual odd practical hour.
      if (
        remainingPracticalHours === 1
      ) {

        tasks.push({

          id:
            `${subject.id}-P-${labNumber}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            subject.semester,

          type:
            subject.type === "project"
              ? "project"
              : subject.type === "seminar"
                ? "seminar"
                : "lab",

          duration:
            1

        });

      }

    }
  );


  // Put longer tasks first.
  // This makes lab scheduling much easier.
  tasks.sort(
    (a, b) => {

      if (
        b.duration !== a.duration
      ) {

        return (
          b.duration -
          a.duration
        );

      }


      const priority = {
        lab: 1,
        project: 2,
        seminar: 3,
        lecture: 4,
        tutorial: 5
      };


      return (
        (priority[a.type] || 99) -
        (priority[b.type] || 99)
      );

    }
  );


  return shuffle(tasks);

}


// ============================================================
// CREATE SCHEDULE
// ============================================================

function createSchedule(
  tasks,
  workingDays,
  facultyList,
  rooms,
  year,
  semester
) {

  const entries = [];


  const facultyBusy =
    new Set();


  const roomBusy =
    new Set();


  const classBusy =
    new Set();


  const facultyWorkload =
    new Map();


  facultyList.forEach(
    faculty => {

      facultyWorkload.set(
        faculty.id,
        0
      );

    }
  );


  const candidateDays =
    shuffle(
      [...workingDays]
    );


  for (
    const task of tasks
  ) {

    const candidates =
      findCandidates(
        task,
        candidateDays,
        facultyList,
        rooms,
        facultyBusy,
        roomBusy,
        classBusy,
        facultyWorkload,
        year,
        semester
      );


    if (
      candidates.length === 0
    ) {

      return {
        success: false,

        message:
          `Unable to schedule "${task.subjectName}" (${task.type}). There is no free faculty, room/lab or time slot without a clash.`,

        entries

      };

    }


    // Pick the candidate with the lowest
    // current faculty workload.
    candidates.sort(
      (a, b) => {

        if (
          a.facultyWorkload !==
          b.facultyWorkload
        ) {

          return (
            a.facultyWorkload -
            b.facultyWorkload
          );

        }


        return Math.random() - 0.5;

      }
    );


    const selected =
      candidates[0];


    // --------------------------------------------------------
    // CREATE ENTRY FOR EACH PERIOD
    // --------------------------------------------------------

    selected.periodIds.forEach(
      periodId => {

        const entry = {

          day:
            selected.day,

          period:
            periodId,

          subjectId:
            task.subjectId,

          subjectName:
            task.subjectName,

          year:
            task.year,

          semester:
            task.semester,

          type:
            task.type,

          facultyId:
            selected.faculty.id,

          facultyName:
            selected.faculty.name,

          roomId:
            selected.room.id,

          roomName:
            selected.room.name,

          labBatch:
            selected.room.batches?.join(", ") || ""

        };


        entries.push(entry);


        // Class/cohort busy
        classBusy.add(
          getClassKey(
            year,
            semester,
            selected.day,
            periodId
          )
        );


        // Faculty busy
        facultyBusy.add(
          getFacultyKey(
            selected.faculty.id,
            selected.day,
            periodId
          )
        );


        // Room busy
        roomBusy.add(
          getRoomKey(
            selected.room.id,
            selected.day,
            periodId
          )
        );

      }
    );


    facultyWorkload.set(
      selected.faculty.id,

      (
        facultyWorkload.get(
          selected.faculty.id
        ) || 0
      ) + task.duration
    );

  }


  return {
    success: true,
    entries
  };

}


// ============================================================
// FIND CANDIDATES
// ============================================================

function findCandidates(
  task,
  candidateDays,
  facultyList,
  rooms,
  facultyBusy,
  roomBusy,
  classBusy,
  facultyWorkload,
  year,
  semester
) {

  const candidates = [];


  const suitableRooms =
    rooms.filter(
      room => {

        if (
          task.type === "lab"
        ) {

          return room.type === "lab";

        }


        if (
          task.type === "project"
        ) {

          return true;

        }


        if (
          task.type === "seminar"
        ) {

          return (
            room.type === "classroom" ||
            room.type === "lab"
          );

        }


        return (
          room.type === "classroom"
        );

      }
    );


  const suitableFaculty =
    facultyList.filter(
      faculty => {

        if (
          faculty.active === false
        ) {

          return false;

        }


        // All faculty are considered qualified
        // for the project requirements.
        //
        // If qualification data exists, it is
        // intentionally NOT enforced here.


        return true;

      }
    );


  for (
    const day of candidateDays
  ) {

    // Faculty must be available on this day.
    const dayFaculty =
      suitableFaculty.filter(
        faculty => {

          const availableDays =
            Array.isArray(
              faculty.availableDays
            )
              ? faculty.availableDays
              : DAYS;


          return (
            availableDays.includes(day) ||
            availableDays.length === 0
          );

        }
      );


    const periodOptions =
      task.duration === 2
        ? LAB_BLOCKS
        : PERIODS.map(
            period => [
              period.id
            ]
          );


    for (
      const periodIds of shuffle(
        [...periodOptions]
      )
    ) {

      // ------------------------------------------------------
      // Check class/cohort clash
      // ------------------------------------------------------

      const classAvailable =
        periodIds.every(
          periodId =>
            !classBusy.has(
              getClassKey(
                year,
                semester,
                day,
                periodId
              )
            )
        );


      if (!classAvailable) {
        continue;
      }


      // ------------------------------------------------------
      // Faculty candidates
      // ------------------------------------------------------

      const facultyCandidates =
        dayFaculty.filter(
          faculty => {

            return periodIds.every(
              periodId =>
                !facultyBusy.has(
                  getFacultyKey(
                    faculty.id,
                    day,
                    periodId
                  )
                )
            );

          }
        );


      if (
        facultyCandidates.length === 0
      ) {

        continue;

      }


      // ------------------------------------------------------
      // Room candidates
      // ------------------------------------------------------

      const roomCandidates =
        suitableRooms.filter(
          room => {

            return periodIds.every(
              periodId =>
                !roomBusy.has(
                  getRoomKey(
                    room.id,
                    day,
                    periodId
                  )
                )
            );

          }
        );


      if (
        roomCandidates.length === 0
      ) {

        continue;

      }


      // ------------------------------------------------------
      // Create candidate combinations
      // ------------------------------------------------------

      facultyCandidates.forEach(
        faculty => {

          roomCandidates.forEach(
            room => {

              candidates.push({

                day,

                periodIds,

                faculty,

                room,

                facultyWorkload:
                  facultyWorkload.get(
                    faculty.id
                  ) || 0

              });

            }
          );

        }
      );

    }

  }


  return candidates;

}


// ============================================================
// KEY HELPERS
// ============================================================

function getClassKey(
  year,
  semester,
  day,
  period
) {

  return (
    `${year}_${semester}_${day}_${period}`
  );

}


function getFacultyKey(
  facultyId,
  day,
  period
) {

  return (
    `${facultyId}_${day}_${period}`
  );

}


function getRoomKey(
  roomId,
  day,
  period
) {

  return (
    `${roomId}_${day}_${period}`
  );

}


// ============================================================
// STATUS
// ============================================================

function showStatus(
  message,
  type = "info"
) {

  const element =
    document.querySelector(
      "#generatorMessage"
    );


  if (!element) {
    return;
  }


  element.textContent =
    message;


  element.className =
    `form-message ${type}`;

}


// ============================================================
// GENERATION RESULT
// ============================================================

function renderGenerationResult(
  entries,
  load
) {

  const element =
    document.querySelector(
      "#generationStatus"
    );


  if (!element) {
    return;
  }


  const lectures =
    entries.filter(
      entry =>
        entry.type === "lecture"
    ).length;


  const tutorials =
    entries.filter(
      entry =>
        entry.type === "tutorial"
    ).length;


  const labs =
    entries.filter(
      entry =>
        entry.type === "lab" ||
        entry.type === "project" ||
        entry.type === "seminar"
    ).length;


  element.innerHTML = `

    <div class="status-summary">

      <strong>
        Timetable Generated
      </strong>

      <div>
        L: ${load.L}
        &nbsp;|&nbsp;
        T: ${load.T}
        &nbsp;|&nbsp;
        P: ${load.P}
        &nbsp;|&nbsp;
        Total: ${load.total}
      </div>

      <div>
        Scheduled entries:
        ${entries.length}
      </div>

      <div>
        Lecture periods:
        ${lectures}
      </div>

      <div>
        Tutorial periods:
        ${tutorials}
      </div>

      <div>
        Lab/Project/Seminar periods:
        ${labs}
      </div>

    </div>

  `;

}


// ============================================================
// UI HELPERS
// ============================================================

function setText(
  selector,
  value
) {

  const element =
    document.querySelector(
      selector
    );


  if (element) {

    element.textContent =
      value;

  }

}


// ============================================================
// SHUFFLE
// ============================================================

function shuffle(array) {

  const result =
    [...array];


  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      result[i],
      result[j]
    ] = [
      result[j],
      result[i]
    ];

  }


  return result;

}


// ============================================================
// HTML SECURITY
// ============================================================

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


function escapeAttribute(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    );

}


// ============================================================
// START
// ============================================================

initialisePage()
  .catch(
    error => {

      if (
        error.message !==
        "Firebase has not been configured."
      ) {

        console.error(
          "Generator page error:",
          error
        );

      }

    }
  );