// ============================================================
// TIMELY - AUTOMATIC TIMETABLE GENERATOR
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
// FIRESTORE COLLECTIONS
// ============================================================

const subjectsCollection = collection(db, "subjects");
const facultyCollection = collection(db, "faculty");
const roomsCollection = collection(db, "rooms");
const facultyAssignmentsCollection =
  collection(db, "facultyAssignments");
const timetablesCollection =
  collection(db, "timetables");

// ============================================================
// DAYS / PERIODS
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
    start: "10:30",
    end: "11:30",
    time: "10:30 - 11:30"
  },
  {
    id: "P2",
    start: "11:30",
    end: "12:30",
    time: "11:30 - 12:30"
  },
  {
    id: "P3",
    start: "12:30",
    end: "13:30",
    time: "12:30 - 1:30"
  },
  {
    id: "P4",
    start: "14:15",
    end: "15:15",
    time: "2:15 - 3:15"
  },
  {
    id: "P5",
    start: "15:30",
    end: "16:30",
    time: "3:30 - 4:30"
  },
  {
    id: "P6",
    start: "16:30",
    end: "17:30",
    time: "4:30 - 5:30"
  }
];

// Valid 2-hour blocks only.
const TWO_HOUR_BLOCKS = [
  ["P1", "P2"],
  ["P2", "P3"],
  ["P5", "P6"]
];

const MAX_ATTEMPTS = 150;

// ============================================================
// GLOBAL DATA
// ============================================================

let allSubjects = [];
let allFaculty = [];
let allRooms = [];
let allFacultyAssignments = [];
let existingTimetables = [];

let electiveGroups = {};
let selectedWorkingDays = [...DAYS];

// ============================================================
// INITIALISE
// ============================================================

async function initialisePage() {

  try {

    renderNavigation();

    await requireAuthenticatedUser();

    const protectedContent =
      document.querySelector("#protectedContent");

    if (protectedContent) {
      protectedContent.removeAttribute("hidden");
    }

    enableSignOut();

    setupEvents();

    await loadData();

    updateWorkingDays();
    updateElectiveUI();
    updateRequirementSummary();

    showStatus(
      "Setup data loaded successfully.",
      "success"
    );

  } catch (error) {

    console.error(
      "Generator initialisation error:",
      error
    );

    showMessage(
      error.message ||
      "Unable to initialise timetable generator.",
      "error"
    );

  }

}

// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  const year =
    document.querySelector("#academicYear");

  const semester =
    document.querySelector("#semester");

  const form =
    document.querySelector("#generatorForm");

  const electiveList =
    document.querySelector("#electiveList");

  year?.addEventListener(
    "change",
    () => {

      updateElectiveUI();
      updateRequirementSummary();
      clearMessage();

    }
  );

  semester?.addEventListener(
    "change",
    () => {

      updateElectiveUI();
      updateRequirementSummary();
      clearMessage();

    }
  );

  document
    .querySelectorAll(".working-day")
    .forEach(box => {

      box.addEventListener(
        "change",
        () => {

          updateWorkingDays();
          updateRequirementSummary();

        }
      );

    });

  electiveList?.addEventListener(
    "change",
    () => {

      updateRequirementSummary();

    }
  );

  // IMPORTANT:
  // generator.html uses:
  // <form id="generatorForm">
  // <button type="submit">
  //
  // Therefore handle SUBMIT, not only CLICK.

  form?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();
      event.stopPropagation();

      await generateTimetable();

    }
  );

}

// ============================================================
// LOAD DATA
// ============================================================

async function loadData() {

  showStatus(
    "Loading subjects, faculty, rooms and assignments...",
    "info"
  );

  try {

    const [
      subjectsSnapshot,
      facultySnapshot,
      roomsSnapshot,
      assignmentsSnapshot,
      timetablesSnapshot
    ] = await Promise.all([

      getDocs(subjectsCollection),
      getDocs(facultyCollection),
      getDocs(roomsCollection),
      getDocs(facultyAssignmentsCollection),
      getDocs(timetablesCollection)

    ]);

    allSubjects =
      subjectsSnapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item =>
          item.active !== false
        );

    allFaculty =
      facultySnapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item =>
          item.active !== false
        );

    allRooms =
      roomsSnapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item => {

          const status =
            String(
              item.status ||
              "available"
            ).toLowerCase();

          return (
            status !== "unavailable" &&
            status !== "inactive"
          );

        })
        .map(normalizeRoom);

    allFacultyAssignments =
      assignmentsSnapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }));

    existingTimetables =
      timetablesSnapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }));

    console.log(
      "Subjects:",
      allSubjects
    );

    console.log(
      "Faculty:",
      allFaculty
    );

    console.log(
      "Rooms:",
      allRooms
    );

    console.log(
      "Faculty Assignments:",
      allFacultyAssignments
    );

    console.log(
      "Existing Timetables:",
      existingTimetables
    );

  } catch (error) {

    console.error(
      "Firebase loading error:",
      error
    );

    showMessage(
      "Unable to load Firebase data: " +
      error.message,
      "error"
    );

    throw error;

  }

}

// ============================================================
// ROOM NORMALIZATION
// ============================================================

function normalizeRoom(room) {

  const type =
    String(
      room.type || ""
    )
    .trim()
    .toLowerCase();

  return {

    ...room,

    type:
      type === "lab"
        ? "lab"
        : "classroom",

    batches:
      Array.isArray(room.batches)
        ? room.batches
        : []

  };

}

// ============================================================
// WORKING DAYS
// ============================================================

function updateWorkingDays() {

  selectedWorkingDays =
    Array.from(
      document.querySelectorAll(
        ".working-day:checked"
      )
    )
    .map(box => box.value);

}

// ============================================================
// ELECTIVE UI
// ============================================================

function updateElectiveUI() {

  const year =
    document.querySelector(
      "#academicYear"
    )?.value || "";

  const semester =
    Number(
      document.querySelector(
        "#semester"
      )?.value || 0
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

  electiveGroups = {};

  const semesterSubjects =
    allSubjects.filter(subject => {

      return (
        String(subject.year) ===
          String(year) &&

        Number(subject.semester) ===
          Number(semester) &&

        subject.active !== false
      );

    });

  semesterSubjects.forEach(subject => {

    const group =
      String(
        subject.electiveGroup || ""
      ).trim();

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

  if (!groups.length) {

    section.style.display = "none";
    list.innerHTML = "";

    return;

  }

  section.style.display = "block";

  list.innerHTML =
    groups.map(group => {

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
              (subject, index) => `

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
                    name="elective_${escapeAttribute(group)}"
                    value="${escapeAttribute(subject.id)}"
                    class="elective-option"
                    ${index === 0 ? "checked" : ""}
                  >

                  <span>

                    <strong>
                      ${escapeHtml(
                        subject.name || ""
                      )}
                    </strong>

                    <br>

                    <small>
                      L${num(
                        subject.lectureHours
                      )}
                      T${num(
                        subject.tutorialHours
                      )}
                      P${num(
                        subject.practicalHours
                      )}
                    </small>

                  </span>

                </label>

              `
            ).join("")}

          </div>

        </div>

      `;

    }).join("");

}

// ============================================================
// SELECTED ELECTIVES
// ============================================================

function getSelectedElectiveIds() {

  return new Set(

    Array.from(
      document.querySelectorAll(
        "#electiveList input[type='radio']:checked"
      )
    )
    .map(input =>
      input.value
    )

  );

}

// ============================================================
// SCHEDULABLE SUBJECTS
// ============================================================

function getSchedulableSubjects() {

  const year =
    document.querySelector(
      "#academicYear"
    )?.value || "";

  const semester =
    Number(
      document.querySelector(
        "#semester"
      )?.value || 0
    );

  const selectedElectives =
    getSelectedElectiveIds();

  return allSubjects.filter(
    subject => {

      if (
        String(subject.year) !==
        String(year)
      ) {
        return false;
      }

      if (
        Number(subject.semester) !==
        Number(semester)
      ) {
        return false;
      }

      if (
        subject.active === false
      ) {
        return false;
      }

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
// LOAD CALCULATION
// ============================================================

function calculateLoad(subjects) {

  const L =
    subjects.reduce(
      (sum, subject) =>
        sum +
        num(
          subject.lectureHours
        ),
      0
    );

  const T =
    subjects.reduce(
      (sum, subject) =>
        sum +
        num(
          subject.tutorialHours
        ),
      0
    );

  const P =
    subjects.reduce(
      (sum, subject) =>
        sum +
        num(
          subject.practicalHours
        ),
      0
    );

  return {

    L,
    T,
    P,

    total:
      L + T + P

  };

}

// ============================================================
// REQUIREMENT SUMMARY
// ============================================================

function updateRequirementSummary() {

  const summary =
    document.querySelector(
      "#requirementSummary"
    );

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

  if (summary) {

    summary.style.display =
      subjects.length
        ? "block"
        : "none";

  }

}

// ============================================================
// MAIN GENERATOR
// ============================================================

async function generateTimetable() {

  const button =
    document.querySelector(
      "#generateButton"
    );

  clearMessage();

  const year =
    document.querySelector(
      "#academicYear"
    )?.value || "";

  const semester =
    Number(
      document.querySelector(
        "#semester"
      )?.value || 0
    );

  try {

    updateWorkingDays();

    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!year) {

      throw new Error(
        "Please select an Academic Year."
      );

    }

    if (!semester) {

      throw new Error(
        "Please select a Semester."
      );

    }

    if (
      selectedWorkingDays.length === 0
    ) {

      throw new Error(
        "Please select at least one Working Day."
      );

    }

    const subjects =
      getSchedulableSubjects();

    if (!subjects.length) {

      throw new Error(
        `No subjects found for ${year}, Semester ${semester}.`
      );

    }

    // Check elective selections.
    for (
      const group of Object.keys(
        electiveGroups
      )
    ) {

      const safeName =
        escapeCss(group);

      const selected =
        document.querySelector(
          `input[name="elective_${safeName}"]:checked`
        );

      if (!selected) {

        throw new Error(
          `Please select one subject from ${group}.`
        );

      }

    }

    const load =
      calculateLoad(subjects);

    const availablePeriods =
      selectedWorkingDays.length *
      PERIODS.length;

    if (
      load.total >
      availablePeriods
    ) {

      throw new Error(
        `Required ${load.total} periods but only ${availablePeriods} periods are available.`
      );

    }

    if (!allFaculty.length) {

      throw new Error(
        "No active faculty found."
      );

    }

    if (!allRooms.length) {

      throw new Error(
        "No available classrooms or laboratories found."
      );

    }

    // --------------------------------------------------------
    // SUBJECT-FACULTY ASSIGNMENT CHECK
    // --------------------------------------------------------

    validateSubjectAssignments(
      subjects,
      year,
      semester
    );

    // --------------------------------------------------------
    // CREATE TASKS
    // --------------------------------------------------------

    const tasks =
      createTasks(subjects);

    if (!tasks.length) {

      throw new Error(
        "No timetable tasks could be created."
      );

    }

    console.log(
      "Generation Tasks:",
      tasks
    );

    setButtonGenerating(
      button
    );

    showStatus(
      `Generating ${year}, Semester ${semester}...`,
      "info"
    );

    // --------------------------------------------------------
    // EXISTING TIMETABLE OCCUPANCY
    // --------------------------------------------------------

    const external =
      buildExternalOccupancy(
        year,
        semester
      );

    // --------------------------------------------------------
    // TRY MANY TIMES
    // --------------------------------------------------------

    let result = null;
    let lastMessage = "";

    for (
      let attempt = 1;
      attempt <= MAX_ATTEMPTS;
      attempt++
    ) {

      showStatus(
        `Generating timetable... Attempt ${attempt}/${MAX_ATTEMPTS}`,
        "info"
      );

      result =
        createSchedule(
          tasks,
          selectedWorkingDays,
          allFaculty,
          allRooms,
          year,
          semester,
          external
        );

      if (
        result.success
      ) {

        result.attempt =
          attempt;

        break;

      }

      lastMessage =
        result.message ||
        "Unable to create schedule.";

    }

    if (
      !result ||
      !result.success
    ) {

      throw new Error(
        lastMessage ||
        "Unable to generate a conflict-free timetable."
      );

    }

    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    showStatus(
      "Timetable generated. Saving to Firebase...",
      "info"
    );

    const timetableId =
      `${year}_${semester}`;

    const timetableData = {

      year,

      semester,

      workingDays:
        [...selectedWorkingDays],

      periods:
        PERIODS,

      load,

      entries:
        result.entries,

      generatedAt:
        serverTimestamp(),

      generationInfo: {

        attempts:
          result.attempt,

        subjectCount:
          subjects.length,

        entryCount:
          result.entries.length,

        coordinated:
          true

      }

    };

    await setDoc(
      doc(
        db,
        "timetables",
        timetableId
      ),
      timetableData
    );

    // Update local copy.
    existingTimetables =
      existingTimetables.filter(
        timetable =>
          !(
            String(timetable.year) ===
              String(year) &&

            Number(timetable.semester) ===
              Number(semester)
          )
      );

    existingTimetables.push({

      id:
        timetableId,

      ...timetableData

    });

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    showStatus(
      `Timetable generated successfully. ${result.entries.length} period entries created.`,
      "success"
    );

    showMessage(
      `Timetable generated successfully for ${year}, Semester ${semester}.`,
      "success"
    );

    renderGenerationResult(
      result.entries,
      load
    );

  } catch (error) {

    console.error(
      "TIMETABLE GENERATION ERROR:",
      error
    );

    showStatus(
      "Timetable generation failed.",
      "error"
    );

    showMessage(
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
// CREATE TASKS
// ============================================================

function createTasks(subjects) {

  const tasks = [];

  subjects.forEach(
    subject => {

      const type =
        normalizeSubjectType(
          subject
        );

      // ------------------------------------------------------
      // LECTURES
      // ------------------------------------------------------

      const lectureHours =
        num(
          subject.lectureHours
        );

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
            Number(
              subject.semester
            ),

          type:
            "lecture",

          duration:
            1,

          priority:
            5

        });

      }

      // ------------------------------------------------------
      // TUTORIALS
      // ------------------------------------------------------

      const tutorialHours =
        num(
          subject.tutorialHours
        );

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
            Number(
              subject.semester
            ),

          type:
            "tutorial",

          duration:
            1,

          priority:
            4

        });

      }

      // ------------------------------------------------------
      // PRACTICALS
      // ------------------------------------------------------

      let practicalHours =
        num(
          subject.practicalHours
        );

      let block =
        1;

      while (
        practicalHours >= 2
      ) {

        let taskType =
          "lab";

        if (
          type === "seminar"
        ) {
          taskType =
            "seminar";
        }

        if (
          type === "project"
        ) {
          taskType =
            "project";
        }

        tasks.push({

          id:
            `${subject.id}-P-${block}`,

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
            taskType,

          duration:
            2,

          priority:
            taskType === "lab"
              ? 1
              : 2

        });

        block++;

        practicalHours -= 2;

      }

      // ------------------------------------------------------
      // ODD PRACTICAL HOUR
      // ------------------------------------------------------

      if (
        practicalHours === 1
      ) {

        let taskType =
          "lab";

        if (
          type === "seminar"
        ) {
          taskType =
            "seminar";
        }

        if (
          type === "project"
        ) {
          taskType =
            "project";
        }

        tasks.push({

          id:
            `${subject.id}-P-${block}`,

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
            taskType,

          duration:
            1,

          priority:
            2

        });

      }

    }
  );

  // Longer tasks first.
  return shuffle(tasks).sort(
    (a, b) => {

      if (
        a.duration !==
        b.duration
      ) {

        return (
          b.duration -
          a.duration
        );

      }

      return (
        a.priority -
        b.priority
      );

    }
  );

}

// ============================================================
// SUBJECT TYPE
// ============================================================

function normalizeSubjectType(
  subject
) {

  const explicitType =
    String(
      subject.type || ""
    )
    .trim()
    .toLowerCase();

  if (
    explicitType ===
    "seminar"
  ) {
    return "seminar";
  }

  if (
    explicitType ===
    "project"
  ) {
    return "project";
  }

  if (
    explicitType ===
    "lab"
  ) {
    return "lab";
  }

  const name =
    String(
      subject.name || ""
    ).toLowerCase();

  if (
    name.includes(
      "seminar"
    )
  ) {
    return "seminar";
  }

  if (
    name.includes(
      "mini project"
    ) ||
    name.includes(
      "project work"
    )
  ) {
    return "project";
  }

  return "theory";

}

// ============================================================
// ASSIGNMENT VALIDATION
// ============================================================

function validateSubjectAssignments(
  subjects,
  year,
  semester
) {

  const missing = [];

  subjects.forEach(
    subject => {

      const assigned =
        getAssignedFaculty(
          subject.id,
          year,
          semester
        );

      if (
        assigned.length === 0
      ) {

        missing.push(
          subject.name
        );

      }

    }
  );

  if (
    missing.length
  ) {

    throw new Error(
      "No faculty assigned for: " +
      missing.join(", ") +
      ". Please assign faculty from Subject Assignment."
    );

  }

}

// ============================================================
// GET ASSIGNED FACULTY
// ============================================================

function getAssignedFaculty(
  subjectId,
  year,
  semester
) {

  const facultyIds =
    new Set();

  allFacultyAssignments.forEach(
    assignment => {

      const facultyId =
        assignment.facultyId;

      if (!facultyId) {
        return;
      }

      // ------------------------------------------------------
      // subjectIds FORMAT
      // ------------------------------------------------------

      if (
        Array.isArray(
          assignment.subjectIds
        ) &&
        assignment.subjectIds.some(
          id =>
            String(id) ===
            String(subjectId)
        )
      ) {

        let matches =
          true;

        if (
          assignment.year !==
            undefined &&
          assignment.year !==
            null &&
          assignment.year !== ""
        ) {

          matches =
            matches &&
            String(
              assignment.year
            ) ===
            String(year);

        }

        if (
          assignment.semester !==
            undefined &&
          assignment.semester !==
            null &&
          assignment.semester !== ""
        ) {

          matches =
            matches &&
            Number(
              assignment.semester
            ) ===
            Number(semester);

        }

        if (
          matches
        ) {

          facultyIds.add(
            facultyId
          );

        }

      }

      // ------------------------------------------------------
      // assignments[] FORMAT
      // ------------------------------------------------------

      if (
        Array.isArray(
          assignment.assignments
        )
      ) {

        assignment.assignments.forEach(
          item => {

            if (
              String(
                item.subjectId
              ) !==
              String(subjectId)
            ) {
              return;
            }

            if (
              item.year !==
                undefined &&
              item.year !==
                null &&
              item.year !== "" &&
              String(
                item.year
              ) !==
              String(year)
            ) {
              return;
            }

            if (
              item.semester !==
                undefined &&
              item.semester !==
                null &&
              item.semester !== "" &&
              Number(
                item.semester
              ) !==
              Number(semester)
            ) {
              return;
            }

            facultyIds.add(
              facultyId
            );

          }
        );

      }

    }
  );

  return allFaculty.filter(
    faculty =>
      facultyIds.has(
        faculty.id
      )
  );

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
  semester,
  external
) {

  const facultyBusy =
    new Set(
      external.facultyBusy
    );

  const roomBusy =
    new Set(
      external.roomBusy
    );

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

  const entries = [];

  // Randomize task order every attempt.
  const orderedTasks =
    shuffle(
      [...tasks]
    ).sort(
      (a, b) => {

        if (
          a.duration !==
          b.duration
        ) {

          return (
            b.duration -
            a.duration
          );

        }

        return (
          a.priority -
          b.priority
        );

      }
    );

  // ----------------------------------------------------------
  // BACKTRACKING
  // ----------------------------------------------------------

  function placeTask(
    index
  ) {

    if (
      index >=
      orderedTasks.length
    ) {

      return true;

    }

    const task =
      orderedTasks[index];

    const candidates =
      findCandidates(
        task,
        workingDays,
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

      return false;

    }

    // Least loaded faculty first.
    candidates.sort(
      (a, b) => {

        const scoreA =
          a.facultyWorkload * 10 +
          a.roomUsage +
          Math.random() * 2;

        const scoreB =
          b.facultyWorkload * 10 +
          b.roomUsage +
          Math.random() * 2;

        return (
          scoreA -
          scoreB
        );

      }
    );

    for (
      const candidate of candidates
    ) {

      reserveCandidate(
        candidate,
        task,
        year,
        semester,
        facultyBusy,
        roomBusy,
        classBusy,
        facultyWorkload,
        entries
      );

      if (
        placeTask(
          index + 1
        )
      ) {

        return true;

      }

      unreserveCandidate(
        candidate,
        task,
        year,
        semester,
        facultyBusy,
        roomBusy,
        classBusy,
        facultyWorkload,
        entries
      );

    }

    return false;

  }

  const success =
    placeTask(0);

  if (!success) {

    const difficult =
      orderedTasks.find(
        task => {

          const candidates =
            findCandidates(
              task,
              workingDays,
              facultyList,
              rooms,
              facultyBusy,
              roomBusy,
              classBusy,
              facultyWorkload,
              year,
              semester
            );

          return (
            candidates.length === 0
          );

        }
      );

    return {

      success:
        false,

      message:
        difficult
          ? `Unable to schedule "${difficult.subjectName}" (${difficult.type}). Check faculty assignment, faculty availability, rooms/labs and existing semester timetables.`
          : "No conflict-free timetable was found.",

      entries: []

    };

  }

  return {

    success:
      true,

    entries

  };

}

// ============================================================
// FIND CANDIDATES
// ============================================================

function findCandidates(
  task,
  workingDays,
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

  // ONLY faculty assigned to the subject.
  const assignedFaculty =
    getAssignedFaculty(
      task.subjectId,
      year,
      semester
    );

  if (
    assignedFaculty.length === 0
  ) {

    return [];

  }

  // ----------------------------------------------------------
  // ROOM TYPE
  // ----------------------------------------------------------

  const suitableRooms =
    rooms.filter(
      room => {

        // Actual laboratory.
        if (
          task.type === "lab"
        ) {

          return (
            room.type ===
            "lab"
          );

        }

        // Project can use classroom or lab.
        if (
          task.type === "project"
        ) {

          return (
            room.type ===
              "classroom" ||
            room.type ===
              "lab"
          );

        }

        // Seminar uses classroom.
        if (
          task.type === "seminar"
        ) {

          return (
            room.type ===
            "classroom"
          );

        }

        // Lecture/tutorial uses classroom.
        return (
          room.type ===
          "classroom"
        );

      }
    );

  if (
    suitableRooms.length === 0
  ) {

    return [];

  }

  const dayOptions =
    shuffle(
      [...workingDays]
    );

  const periodOptions =
    task.duration === 2

      ? shuffle(
          TWO_HOUR_BLOCKS.map(
            block =>
              [...block]
          )
        )

      : shuffle(
          PERIODS.map(
            period =>
              [period.id]
          )
        );

  // ----------------------------------------------------------
  // DAYS
  // ----------------------------------------------------------

  for (
    const day of dayOptions
  ) {

    const availableFaculty =
      assignedFaculty.filter(
        faculty => {

          const availableDays =
            Array.isArray(
              faculty.availableDays
            )
              ? faculty.availableDays
              : [];

          // If availability exists,
          // faculty must be available that day.
          if (
            availableDays.length > 0 &&
            !availableDays.includes(day)
          ) {

            return false;

          }

          return facultyList.some(
            f =>
              f.id ===
              faculty.id
          );

        }
      );

    if (
      availableFaculty.length === 0
    ) {

      continue;

    }

    // --------------------------------------------------------
    // PERIODS
    // --------------------------------------------------------

    for (
      const periodIds of periodOptions
    ) {

      // Student/year clash.
      const classAvailable =
        periodIds.every(
          periodId => {

            return !classBusy.has(
              getClassKey(
                year,
                semester,
                day,
                periodId
              )
            );

          }
        );

      if (
        !classAvailable
      ) {

        continue;

      }

      // Faculty clash.
      const freeFaculty =
        availableFaculty.filter(
          faculty => {

            return periodIds.every(
              periodId => {

                return !facultyBusy.has(
                  getFacultyKey(
                    faculty.id,
                    day,
                    periodId
                  )
                );

              }
            );

          }
        );

      if (
        freeFaculty.length === 0
      ) {

        continue;

      }

      // Room clash.
      const freeRooms =
        suitableRooms.filter(
          room => {

            return periodIds.every(
              periodId => {

                return !roomBusy.has(
                  getRoomKey(
                    room.id,
                    day,
                    periodId
                  )
                );

              }
            );

          }
        );

      if (
        freeRooms.length === 0
      ) {

        continue;

      }

      // Create candidate combinations.
      freeFaculty.forEach(
        faculty => {

          freeRooms.forEach(
            room => {

              candidates.push({

                day,

                periodIds:
                  [...periodIds],

                faculty,

                room,

                facultyWorkload:
                  facultyWorkload.get(
                    faculty.id
                  ) || 0,

                roomUsage:
                  getRoomUsage(
                    room.id,
                    roomBusy
                  )

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
// RESERVE
// ============================================================

function reserveCandidate(
  candidate,
  task,
  year,
  semester,
  facultyBusy,
  roomBusy,
  classBusy,
  facultyWorkload,
  entries
) {

  const blockId =
    `${task.id}_${candidate.day}_${candidate.periodIds[0]}`;

  candidate.periodIds.forEach(
    periodId => {

      classBusy.add(
        getClassKey(
          year,
          semester,
          candidate.day,
          periodId
        )
      );

      facultyBusy.add(
        getFacultyKey(
          candidate.faculty.id,
          candidate.day,
          periodId
        )
      );

      roomBusy.add(
        getRoomKey(
          candidate.room.id,
          candidate.day,
          periodId
        )
      );

      const period =
        PERIODS.find(
          p =>
            p.id ===
            periodId
        );

      entries.push({

        id:
          `${blockId}_${periodId}`,

        blockId,

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

        day:
          candidate.day,

        period:
          periodId,

        periods:
          [...candidate.periodIds],

        startTime:
          period?.start || "",

        endTime:
          period?.end || "",

        facultyId:
          candidate.faculty.id,

        facultyName:
          candidate.faculty.name,

        roomId:
          candidate.room.id,

        roomName:
          candidate.room.name,

        roomType:
          candidate.room.type,

        labType:
          candidate.room.labType ||
          "",

        batches:
          candidate.room.type ===
          "lab"
            ? [
                ...candidate.room.batches
              ]
            : []

      });

    }
  );

  facultyWorkload.set(

    candidate.faculty.id,

    (
      facultyWorkload.get(
        candidate.faculty.id
      ) || 0
    ) +
    candidate.periodIds.length

  );

}

// ============================================================
// UNRESERVE
// ============================================================

function unreserveCandidate(
  candidate,
  task,
  year,
  semester,
  facultyBusy,
  roomBusy,
  classBusy,
  facultyWorkload,
  entries
) {

  candidate.periodIds.forEach(
    periodId => {

      classBusy.delete(
        getClassKey(
          year,
          semester,
          candidate.day,
          periodId
        )
      );

      facultyBusy.delete(
        getFacultyKey(
          candidate.faculty.id,
          candidate.day,
          periodId
        )
      );

      roomBusy.delete(
        getRoomKey(
          candidate.room.id,
          candidate.day,
          periodId
        )
      );

    }
  );

  facultyWorkload.set(

    candidate.faculty.id,

    Math.max(

      0,

      (
        facultyWorkload.get(
          candidate.faculty.id
        ) || 0
      ) -
      candidate.periodIds.length

    )

  );

  const blockId =
    `${task.id}_${candidate.day}_${candidate.periodIds[0]}`;

  for (
    let i =
      entries.length - 1;

    i >= 0;

    i--
  ) {

    if (
      entries[i].blockId ===
      blockId
    ) {

      entries.splice(
        i,
        1
      );

    }

  }

}

// ============================================================
// EXISTING TIMETABLE OCCUPANCY
// ============================================================

function buildExternalOccupancy(
  currentYear,
  currentSemester
) {

  const facultyBusy =
    new Set();

  const roomBusy =
    new Set();

  existingTimetables.forEach(
    timetable => {

      // Don't reserve the timetable
      // currently being regenerated.
      const sameTimetable =
        String(
          timetable.year
        ) ===
        String(
          currentYear
        ) &&
        Number(
          timetable.semester
        ) ===
        Number(
          currentSemester
        );

      if (
        sameTimetable
      ) {

        return;

      }

      const entries =
        Array.isArray(
          timetable.entries
        )
          ? timetable.entries
          : [];

      entries.forEach(
        entry => {

          if (
            !entry.day
          ) {
            return;
          }

          const periods =
            getEntryPeriods(
              entry
            );

          periods.forEach(
            periodId => {

              if (
                entry.facultyId
              ) {

                facultyBusy.add(
                  getFacultyKey(
                    entry.facultyId,
                    entry.day,
                    periodId
                  )
                );

              }

              if (
                entry.roomId
              ) {

                roomBusy.add(
                  getRoomKey(
                    entry.roomId,
                    entry.day,
                    periodId
                  )
                );

              }

            }
          );

        }
      );

    }
  );

  return {

    facultyBusy,

    roomBusy

  };

}

// ============================================================
// ENTRY PERIODS
// ============================================================

function getEntryPeriods(
  entry
) {

  if (
    Array.isArray(
      entry.periods
    ) &&
    entry.periods.length
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
// KEYS
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
// ROOM USAGE
// ============================================================

function getRoomUsage(
  roomId,
  roomBusy
) {

  let count = 0;

  const prefix =
    `${roomId}_`;

  roomBusy.forEach(
    key => {

      if (
        key.startsWith(
          prefix
        )
      ) {

        count++;

      }

    }
  );

  return count;

}

// ============================================================
// RESULT
// ============================================================

function renderGenerationResult(
  entries,
  load
) {

  const status =
    document.querySelector(
      "#generationStatus"
    );

  if (!status) {
    return;
  }

  status.innerHTML = `

    <strong>
      Timetable Generated Successfully
    </strong>

    <div
      style="margin-top:10px;"
    >

      Lectures:
      ${load.L}

      &nbsp; | &nbsp;

      Tutorials:
      ${load.T}

      &nbsp; | &nbsp;

      Practicals:
      ${load.P}

      &nbsp; | &nbsp;

      Total:
      ${load.total}

    </div>

    <div
      style="margin-top:8px;"
    >

      Scheduled entries:
      ${entries.length}

    </div>

    <div
      style="margin-top:8px;"
    >

      Faculty clash prevention:
      Enabled

    </div>

    <div>

      Classroom/Lab clash prevention:
      Enabled

    </div>

    <div>

      Cross-semester coordination:
      Enabled

    </div>

  `;

}

// ============================================================
// STATUS
// ============================================================

function showStatus(
  message,
  type = "info"
) {

  const status =
    document.querySelector(
      "#generationStatus"
    );

  if (status) {

    status.textContent =
      message;

  }

  console.log(
    `[${type}] ${message}`
  );

}

// ============================================================
// MESSAGE
// ============================================================

function showMessage(
  message,
  type = "info"
) {

  const element =
    document.querySelector(
      "#generatorMessage"
    );

  if (!element) {

    console.log(
      `[${type}] ${message}`
    );

    return;

  }

  element.textContent =
    message;

  element.className =
    `form-message ${type}`;

}

// ============================================================
// CLEAR MESSAGE
// ============================================================

function clearMessage() {

  const element =
    document.querySelector(
      "#generatorMessage"
    );

  if (!element) {
    return;
  }

  element.textContent =
    "";

  element.className =
    "form-message";

}

// ============================================================
// BUTTON
// ============================================================

function setButtonGenerating(
  button
) {

  if (!button) {
    return;
  }

  button.disabled =
    true;

  button.textContent =
    "Generating...";

}

// ============================================================
// TEXT
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
// NUMBER
// ============================================================

function num(
  value
) {

  const number =
    Number(value);

  if (
    Number.isFinite(number) &&
    number >= 0
  ) {

    return number;

  }

  return 0;

}

// ============================================================
// SHUFFLE
// ============================================================

function shuffle(
  array
) {

  const result =
    [...array];

  for (
    let i =
      result.length - 1;

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
// ESCAPE ATTRIBUTE
// ============================================================

function escapeAttribute(
  value
) {

  return escapeHtml(
    value
  );

}

// ============================================================
// ESCAPE CSS
// ============================================================

function escapeCss(
  value
) {

  if (
    window.CSS &&
    typeof window.CSS.escape ===
      "function"
  ) {

    return window.CSS.escape(
      value
    );

  }

  return String(value)
    .replace(
      /([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
      "\\$1"
    );

}

// ============================================================
// START
// ============================================================

initialisePage();