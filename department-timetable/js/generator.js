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


// ==================================================
// FIRESTORE COLLECTIONS
// ==================================================

const subjectsCollection =
  collection(db, "subjects");

const facultyCollection =
  collection(db, "faculty");

const roomsCollection =
  collection(db, "rooms");


// ==================================================
// DEFAULT WORKING DAYS
// ==================================================

const DEFAULT_WORKING_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];


// ==================================================
// PERIODS
// ==================================================

const PERIODS = [

  {
    id: "P1",
    label: "P1",
    start: "10:30",
    end: "11:30"
  },

  {
    id: "P2",
    label: "P2",
    start: "11:30",
    end: "12:30"
  },

  {
    id: "P3",
    label: "P3",
    start: "12:30",
    end: "13:30"
  },

  {
    id: "P4",
    label: "P4",
    start: "14:15",
    end: "15:15"
  },

  {
    id: "P5",
    label: "P5",
    start: "15:30",
    end: "16:30"
  },

  {
    id: "P6",
    label: "P6",
    start: "16:30",
    end: "17:30"
  }

];


// ==================================================
// VALID 2-HOUR LAB BLOCKS
// ==================================================

const LAB_BLOCKS = [

  ["P1", "P2"],

  ["P2", "P3"],

  ["P5", "P6"]

];


// ==================================================
// EXPECTED COURSE LOAD
// ==================================================

const EXPECTED_LOAD = {

  3: {
    lecture: 15,
    tutorial: 3,
    practical: 8,
    total: 26
  },

  4: {
    lecture: 15,
    tutorial: 3,
    practical: 8,
    total: 26
  },

  5: {
    lecture: 15,
    tutorial: 3,
    practical: 8,
    total: 26
  },

  6: {
    lecture: 15,
    tutorial: 3,
    practical: 8,
    total: 26
  },

  7: {
    lecture: 15,
    tutorial: 2,
    practical: 12,
    total: 29
  },

  8: {
    lecture: 0,
    tutorial: 0,
    practical: 24,
    total: 24
  }

};


// ==================================================
// GLOBAL DATA
// ==================================================

let allSubjects = [];

let allFaculty = [];

let allRooms = [];

let electiveGroups = {};


// ==================================================
// INITIALISE
// ==================================================

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  document
    .querySelector("#protectedContent")
    .removeAttribute("hidden");

  enableSignOut();

  setupEvents();

  await loadData();

}


// ==================================================
// EVENTS
// ==================================================

function setupEvents() {

  document
    .querySelector("#academicYear")
    .addEventListener(
      "change",
      refreshSetup
    );


  document
    .querySelector("#semester")
    .addEventListener(
      "change",
      refreshSetup
    );


  document
    .querySelector("#generatorForm")
    .addEventListener(
      "submit",
      handleGenerate
    );


  // ----------------------------------------------
  // FORCE MONDAY-SATURDAY
  // ----------------------------------------------

  document
    .querySelectorAll(".working-day")
    .forEach(checkbox => {

      checkbox.checked =
        DEFAULT_WORKING_DAYS.includes(
          checkbox.value
        );

    });

}


// ==================================================
// LOAD FIRESTORE DATA
// ==================================================

async function loadData() {

  const [
    subjectsSnapshot,
    facultySnapshot,
    roomsSnapshot
  ] = await Promise.all([

    getDocs(
      subjectsCollection
    ),

    getDocs(
      facultyCollection
    ),

    getDocs(
      roomsCollection
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
    );


  allRooms =
    roomsSnapshot.docs.map(
      item => ({
        id: item.id,
        ...item.data()
      })
    );


  refreshSetup();

}


// ==================================================
// REFRESH SETUP
// ==================================================

function refreshSetup() {

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


  if (!year || !semester) {

    hideRequirementSummary();

    return;

  }


  const subjects =
    getSemesterSubjects(
      year,
      semester
    );


  buildElectiveSelection(
    subjects
  );


  updateRequirementSummary(
    subjects
  );

}


// ==================================================
// GET SEMESTER SUBJECTS
// ==================================================

function getSemesterSubjects(
  year,
  semester
) {

  return allSubjects.filter(
    subject =>

      subject.active !== false &&

      subject.year === year &&

      Number(subject.semester) === semester

  );

}


// ==================================================
// ELECTIVE GROUP
// ==================================================

function getElectiveGroup(
  subject
) {

  if (
    subject.electiveGroup
  ) {

    return String(
      subject.electiveGroup
    ).trim();

  }


  return "";

}


// ==================================================
// BUILD ELECTIVE SELECTION
// ==================================================

function buildElectiveSelection(
  subjects
) {

  const section =
    document.querySelector(
      "#electiveSection"
    );

  const container =
    document.querySelector(
      "#electiveList"
    );


  electiveGroups = {};


  subjects.forEach(subject => {

    const group =
      getElectiveGroup(
        subject
      );


    if (!group) {
      return;
    }


    if (!electiveGroups[group]) {

      electiveGroups[group] = [];

    }


    electiveGroups[group].push(
      subject
    );

  });


  const groups =
    Object.keys(
      electiveGroups
    );


  if (
    groups.length === 0
  ) {

    section.style.display =
      "none";

    container.innerHTML =
      "";

    return;

  }


  section.style.display =
    "block";


  container.innerHTML =
    groups.map(
      group => {

        const options =
          electiveGroups[group];


        return `

          <div
            style="
              padding:16px;
              border:1px solid #e5e7eb;
              border-radius:10px;
              margin-bottom:12px;
            "
          >

            <strong>
              ${escapeHtml(group)}
            </strong>

            <div
              style="
                margin-top:12px;
                display:grid;
                gap:8px;
              "
            >

              ${options.map(
                (subject, index) => {

                  const checked =
                    index === 0
                      ? "checked"
                      : "";


                  return `

                    <label
                      style="
                        display:flex;
                        gap:10px;
                        align-items:flex-start;
                        cursor:pointer;
                      "
                    >

                      <input
                        type="radio"
                        name="elective_${escapeHtml(group)}"
                        value="${escapeHtml(subject.id)}"
                        class="elective-option"
                        data-group="${escapeHtml(group)}"
                        ${checked}
                      >

                      <span>

                        <strong>
                          ${escapeHtml(
                            subject.name
                          )}
                        </strong>

                        <br>

                        <small>
                          L${Number(
                            subject.lectureHours || 0
                          )}
                          T${Number(
                            subject.tutorialHours || 0
                          )}
                          P${Number(
                            subject.practicalHours || 0
                          )}
                        </small>

                      </span>

                    </label>

                  `;

                }
              ).join("")}

            </div>

          </div>

        `;

      }
    ).join("");


  container
    .querySelectorAll(
      ".elective-option"
    )
    .forEach(
      radio => {

        radio.addEventListener(
          "change",
          () => {

            updateRequirementSummary(
              getSemesterSubjects(
                document.querySelector(
                  "#academicYear"
                ).value,

                Number(
                  document.querySelector(
                    "#semester"
                  ).value
                )
              )
            );

          }
        );

      }
    );

}


// ==================================================
// SELECTED ELECTIVES
// ==================================================

function getSelectedElectiveIds() {

  const selected =
    new Set();


  document
    .querySelectorAll(
      ".elective-option:checked"
    )
    .forEach(
      radio => {

        selected.add(
          radio.value
        );

      }
    );


  return selected;

}


// ==================================================
// GET SCHEDULABLE SUBJECTS
// ==================================================

function getSchedulableSubjects(
  subjects
) {

  const selectedElectives =
    getSelectedElectiveIds();


  return subjects.filter(
    subject => {

      const group =
        getElectiveGroup(
          subject
        );


      // Normal subject

      if (!group) {

        return true;

      }


      // Elective subject:
      // only selected option

      return selectedElectives.has(
        subject.id
      );

    }
  );

}


// ==================================================
// UPDATE REQUIREMENT SUMMARY
// ==================================================

function updateRequirementSummary(
  subjects
) {

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


  if (!year || !semester) {

    hideRequirementSummary();

    return;

  }


  const selectedSubjects =
    getSchedulableSubjects(
      subjects
    );


  const calculated =
    calculateLoad(
      selectedSubjects
    );


  document.querySelector(
    "#requiredLectures"
  ).textContent =
    calculated.lecture;


  document.querySelector(
    "#requiredTutorials"
  ).textContent =
    calculated.tutorial;


  document.querySelector(
    "#requiredPracticals"
  ).textContent =
    calculated.practical;


  document.querySelector(
    "#requiredTotal"
  ).textContent =
    calculated.total;


  document.querySelector(
    "#requirementSummary"
  ).style.display =
    "block";

}


// ==================================================
// HIDE SUMMARY
// ==================================================

function hideRequirementSummary() {

  document.querySelector(
    "#requirementSummary"
  ).style.display =
    "none";

}


// ==================================================
// CALCULATE LOAD
// ==================================================

function calculateLoad(
  subjects
) {

  let lecture = 0;

  let tutorial = 0;

  let practical = 0;


  subjects.forEach(
    subject => {

      lecture +=
        Number(
          subject.lectureHours || 0
        );


      tutorial +=
        Number(
          subject.tutorialHours || 0
        );


      practical +=
        Number(
          subject.practicalHours || 0
        );

    }
  );


  return {

    lecture,

    tutorial,

    practical,

    total:
      lecture +
      tutorial +
      practical

  };

}


// ==================================================
// MAIN GENERATION
// ==================================================

async function handleGenerate(
  event
) {

  event.preventDefault();


  const button =
    document.querySelector(
      "#generateButton"
    );


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


  const workingDays =
    Array.from(
      document.querySelectorAll(
        ".working-day:checked"
      )
    ).map(
      item => item.value
    );


  // ----------------------------------------------
  // VALIDATION
  // ----------------------------------------------

  if (!year) {

    showMessage(
      "Please select an academic year.",
      "error"
    );

    return;

  }


  if (!semester) {

    showMessage(
      "Please select a semester.",
      "error"
    );

    return;

  }


  if (
    workingDays.length === 0
  ) {

    showMessage(
      "Select at least one working day.",
      "error"
    );

    return;

  }


  const allSemesterSubjects =
    getSemesterSubjects(
      year,
      semester
    );


  if (
    allSemesterSubjects.length === 0
  ) {

    showMessage(
      `No subjects found for ${year}, Semester ${semester}.`,
      "error"
    );

    return;

  }


  // ----------------------------------------------
  // ELECTIVE VALIDATION
  // ----------------------------------------------

  const groups =
    Object.keys(
      electiveGroups
    );


  for (
    const group of groups
  ) {

    const selected =
      document.querySelector(
        `input[name="elective_${CSS.escape(group)}"]:checked`
      );


    if (!selected) {

      showMessage(
        `Please select one option from ${group}.`,
        "error"
      );

      return;

    }

  }


  const subjects =
    getSchedulableSubjects(
      allSemesterSubjects
    );


  // ----------------------------------------------
  // CALCULATE LOAD
  // ----------------------------------------------

  const calculated =
    calculateLoad(
      subjects
    );


  const expected =
    EXPECTED_LOAD[
      semester
    ];


  if (!expected) {

    showMessage(
      "This semester is not configured.",
      "error"
    );

    return;

  }


  // ----------------------------------------------
  // COURSE STRUCTURE CHECK
  // ----------------------------------------------

  if (

    calculated.lecture !==
      expected.lecture ||

    calculated.tutorial !==
      expected.tutorial ||

    calculated.practical !==
      expected.practical

  ) {

    showMessage(

      `Course structure mismatch. ` +

      `Expected L${expected.lecture} ` +
      `T${expected.tutorial} ` +
      `P${expected.practical} ` +
      `= ${expected.total} periods, ` +

      `but selected subjects give ` +

      `L${calculated.lecture} ` +
      `T${calculated.tutorial} ` +
      `P${calculated.practical} ` +
      `= ${calculated.total}.`,

      "error"

    );

    return;

  }


  // ----------------------------------------------
  // START GENERATION
  // ----------------------------------------------

  button.disabled =
    true;

  button.textContent =
    "Generating...";


  setStatus(
    `Preparing ${year}, Semester ${semester}...`
  );


  try {

    const faculty =
      allFaculty.filter(
        member =>
          member.active !== false
      );


    const rooms =
      allRooms.filter(
        room =>
          room.status !== "unavailable"
      );


    if (
      faculty.length === 0
    ) {

      throw new Error(
        "No active faculty members found."
      );

    }


    if (
      rooms.length === 0
    ) {

      throw new Error(
        "No available classrooms or laboratories found."
      );

    }


    // --------------------------------------------
    // CHECK PERIOD CAPACITY
    // --------------------------------------------

    const availablePeriods =
      workingDays.length *
      PERIODS.length;


    if (
      calculated.total >
      availablePeriods
    ) {

      throw new Error(

        `Required ${calculated.total} periods, ` +

        `but only ${availablePeriods} periods are available.`

      );

    }


    const tasks =
      createTasks(
        subjects
      );


    setStatus(
      `Scheduling ${tasks.length} teaching blocks...`
    );


    // --------------------------------------------
    // GENERATE
    // --------------------------------------------

    const result =
      generateTimetable({

        year,

        semester,

        workingDays,

        faculty,

        rooms,

        tasks

      });


    if (
      !result.success
    ) {

      throw new Error(
        result.message
      );

    }


    // --------------------------------------------
    // SAVE
    // --------------------------------------------

    setStatus(
      "Saving timetable..."
    );


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

        workingDays,

        periods:
          PERIODS,

        entries:
          result.entries,

        requiredLoad:
          calculated,

        generatedAt:
          serverTimestamp(),

        generationInfo: {

          totalSubjects:
            subjects.length,

          totalBlocks:
            result.entries.length,

          facultyCount:
            faculty.length,

          roomCount:
            rooms.length

        }

      }

    );


    // --------------------------------------------
    // SUCCESS
    // --------------------------------------------

    setStatus(

      `Timetable generated successfully. ` +

      `${result.entries.length} teaching blocks scheduled.`

    );


    showMessage(

      `Timetable generated successfully for ` +

      `${year}, Semester ${semester}. ` +

      `Required load: ${calculated.total} periods.`,

      "success"

    );


  } catch (error) {

    console.error(
      "Timetable generation error:",
      error
    );


    setStatus(
      "Timetable generation failed."
    );


    showMessage(
      error.message ||
      "Unable to generate timetable.",
      "error"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      "Generate Timetable";

  }

}


// ==================================================
// CREATE SCHEDULING TASKS
// ==================================================

function createTasks(
  subjects
) {

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


      // ------------------------------------------
      // LECTURES
      // ------------------------------------------

      for (
        let i = 0;
        i < lectureHours;
        i++
      ) {

        tasks.push({

          id:
            `${subject.id}_L_${i}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            Number(
              subject.semester
            ),

          type:
            "lecture",

          duration:
            1,

          priority:
            1

        });

      }


      // ------------------------------------------
      // TUTORIALS
      // ------------------------------------------

      for (
        let i = 0;
        i < tutorialHours;
        i++
      ) {

        tasks.push({

          id:
            `${subject.id}_T_${i}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            Number(
              subject.semester
            ),

          type:
            "tutorial",

          duration:
            1,

          priority:
            2

        });

      }


      // ------------------------------------------
      // PRACTICALS
      // ------------------------------------------

      const practicalBlocks =
        Math.floor(
          practicalHours / 2
        );


      for (
        let i = 0;
        i < practicalBlocks;
        i++
      ) {

        tasks.push({

          id:
            `${subject.id}_P_${i}`,

          subjectId:
            subject.id,

          subjectName:
            subject.name,

          year:
            subject.year,

          semester:
            Number(
              subject.semester
            ),

          type:
            Number(
              subject.semester
            ) === 8
              ? "project"
              : "lab",

          duration:
            2,

          priority:
            0

        });

      }

    }
  );


  // Labs and projects first

  return tasks.sort(
    (a, b) =>
      a.priority -
      b.priority
  );

}


// ==================================================
// GENERATE TIMETABLE
// ==================================================

function generateTimetable({
  year,
  semester,
  workingDays,
  faculty,
  rooms,
  tasks
}) {

  const entries = [];


  // ----------------------------------------------
  // OCCUPANCY
  // ----------------------------------------------

  const facultyBusy =
    new Set();


  const roomBusy =
    new Set();


  const classBusy =
    new Set();


  // ----------------------------------------------
  // FACULTY WORKLOAD
  // ----------------------------------------------

  const workload =
    new Map();


  faculty.forEach(
    member => {

      workload.set(
        member.id,
        0
      );

    }
  );


  // ----------------------------------------------
  // SCHEDULE EACH TASK
  // ----------------------------------------------

  for (
    const task of tasks
  ) {

    let scheduled =
      false;


    const shuffledDays =
      shuffle(
        [...workingDays]
      );


    for (
      const day of shuffledDays
    ) {

      if (scheduled) {
        break;
      }


      let blocks;


      if (
        task.duration === 2
      ) {

        blocks =
          shuffle(
            [...LAB_BLOCKS]
          );

      } else {

        blocks =
          shuffle(
            PERIODS.map(
              period =>
                [period.id]
            )
          );

      }


      for (
        const block of blocks
      ) {

        if (scheduled) {
          break;
        }


        // ----------------------------------------
        // CLASS CLASH
        // ----------------------------------------

        if (
          isClassBusy(
            classBusy,
            year,
            semester,
            day,
            block
          )
        ) {

          continue;

        }


        // ----------------------------------------
        // FACULTY
        // ----------------------------------------

        const selectedFaculty =
          findAvailableFaculty({

            faculty,

            workload,

            day,

            block,

            facultyBusy

          });


        if (
          !selectedFaculty
        ) {

          continue;

        }


        // ----------------------------------------
        // ROOM
        // ----------------------------------------

        const selectedRoom =
          findAvailableRoom({

            rooms,

            task,

            day,

            block,

            roomBusy

          });


        if (
          !selectedRoom
        ) {

          continue;

        }


        // ----------------------------------------
        // RESERVE
        // ----------------------------------------

        block.forEach(
          periodId => {

            facultyBusy.add(

              makeKey(
                selectedFaculty.id,
                day,
                periodId
              )

            );


            roomBusy.add(

              makeKey(
                selectedRoom.id,
                day,
                periodId
              )

            );


            classBusy.add(

              makeKey(
                `${year}_${semester}`,
                day,
                periodId
              )

            );

          }
        );


        // ----------------------------------------
        // WORKLOAD
        // ----------------------------------------

        workload.set(

          selectedFaculty.id,

          (
            workload.get(
              selectedFaculty.id
            ) || 0
          ) + task.duration

        );


        // ----------------------------------------
        // TIME
        // ----------------------------------------

        const firstPeriod =
          PERIODS.find(
            period =>
              period.id === block[0]
          );


        const lastPeriod =
          PERIODS.find(
            period =>
              period.id ===
              block[
                block.length - 1
              ]
          );


        // ----------------------------------------
        // ENTRY
        // ----------------------------------------

        entries.push({

          id:
            `${task.id}_${day}_${block[0]}`,

          subjectId:
            task.subjectId,

          subjectName:
            task.subjectName,

          year,

          semester,

          type:
            task.type,

          day,

          periods:
            block,

          startTime:
            firstPeriod.start,

          endTime:
            lastPeriod.end,

          facultyId:
            selectedFaculty.id,

          facultyName:
            selectedFaculty.name,

          roomId:
            selectedRoom.id,

          roomName:
            selectedRoom.name,

          roomType:
            selectedRoom.type,

          labType:
            selectedRoom.labType || "",

          batches:
            selectedRoom.type === "lab"

              ? (
                  Array.isArray(
                    selectedRoom.batches
                  )
                    ? selectedRoom.batches
                    : []
                )

              : []

        });


        scheduled =
          true;

      }

    }


    // --------------------------------------------
    // FAILURE
    // --------------------------------------------

    if (!scheduled) {

      return {

        success:
          false,

        message:

          `Unable to schedule "${task.subjectName}" (${task.type}). ` +

          `There are not enough conflict-free slots, rooms or faculty availability.`,

        entries

      };

    }

  }


  return {

    success:
      true,

    entries

  };

}


// ==================================================
// FIND AVAILABLE FACULTY
// ==================================================

function findAvailableFaculty({
  faculty,
  workload,
  day,
  block,
  facultyBusy
}) {

  const candidates =
    faculty.filter(
      member => {

        const availableDays =
          Array.isArray(
            member.availableDays
          )
            ? member.availableDays
            : [];


        // ------------------------------------------
        // DAY AVAILABILITY
        // ------------------------------------------

        if (
          availableDays.length > 0 &&
          !availableDays.includes(day)
        ) {

          return false;

        }


        // ------------------------------------------
        // FACULTY CLASH
        // ------------------------------------------

        for (
          const periodId of block
        ) {

          if (

            facultyBusy.has(

              makeKey(
                member.id,
                day,
                periodId
              )

            )

          ) {

            return false;

          }

        }


        return true;

      }
    );


  // ----------------------------------------------
  // LOWEST WORKLOAD FIRST
  // ----------------------------------------------

  candidates.sort(
    (a, b) => {

      const workloadA =
        workload.get(a.id) || 0;


      const workloadB =
        workload.get(b.id) || 0;


      return (
        workloadA -
        workloadB
      );

    }
  );


  return (
    candidates[0] ||
    null
  );

}


// ==================================================
// FIND AVAILABLE ROOM
// ==================================================

function findAvailableRoom({
  rooms,
  task,
  day,
  block,
  roomBusy
}) {

  let candidates;


  // ----------------------------------------------
  // LAB
  // ----------------------------------------------

  if (
    task.type === "lab"
  ) {

    candidates =
      rooms.filter(
        room =>
          room.type === "lab"
      );

  }

  // ----------------------------------------------
  // PROJECT
  // ----------------------------------------------

  else if (
    task.type === "project"
  ) {

    candidates =
      rooms.filter(
        room =>
          room.type === "classroom" ||
          room.type === "lab"
      );

  }

  // ----------------------------------------------
  // LECTURE/TUTORIAL
  // ----------------------------------------------

  else {

    candidates =
      rooms.filter(
        room =>
          room.type === "classroom"
      );

  }


  // ----------------------------------------------
  // ROOM CLASH
  // ----------------------------------------------

  candidates =
    candidates.filter(
      room => {

        for (
          const periodId of block
        ) {

          if (

            roomBusy.has(

              makeKey(
                room.id,
                day,
                periodId
              )

            )

          ) {

            return false;

          }

        }


        return true;

      }
    );


  return (
    candidates[0] ||
    null
  );

}


// ==================================================
// CLASS CLASH
// ==================================================

function isClassBusy(
  classBusy,
  year,
  semester,
  day,
  block
) {

  for (
    const periodId of block
  ) {

    if (

      classBusy.has(

        makeKey(
          `${year}_${semester}`,
          day,
          periodId
        )

      )

    ) {

      return true;

    }

  }


  return false;

}


// ==================================================
// CREATE RESOURCE KEY
// ==================================================

function makeKey(
  resourceId,
  day,
  periodId
) {

  return (
    `${resourceId}_${day}_${periodId}`
  );

}


// ==================================================
// SHUFFLE
// ==================================================

function shuffle(
  array
) {

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      array[i],
      array[j]
    ] = [
      array[j],
      array[i]
    ];

  }


  return array;

}


// ==================================================
// STATUS
// ==================================================

function setStatus(
  text
) {

  document.querySelector(
    "#generationStatus"
  ).textContent =
    text;

}


// ==================================================
// MESSAGE
// ==================================================

function showMessage(
  message,
  type
) {

  const element =
    document.querySelector(
      "#generatorMessage"
    );


  element.textContent =
    message;


  element.className =
    `form-message ${type}`;

}


// ==================================================
// ESCAPE HTML
// ==================================================

function escapeHtml(
  value
) {

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


// ==================================================
// START
// ==================================================

initialisePage()
  .catch(
    error => {

      if (
        error.message !==
        "Firebase has not been configured."
      ) {

        console.error(
          error
        );

      }

    }
  );