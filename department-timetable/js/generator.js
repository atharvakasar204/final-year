// ============================================================
// TIMELY - AUTOMATIC TIMETABLE GENERATOR
// generator.js
//
// FEATURES
// ------------------------------------------------------------
// Single semester generation
// All odd semesters together: SE-3 + TE-5 + BE-7
// All even semesters together: SE-4 + TE-6 + BE-8
//
// L/T/P subject hours
// Elective selection
// Faculty assignment from facultyAssignments
// Faculty availability
// Faculty clash prevention
// Student/cohort clash prevention
// Classroom clash prevention
// Laboratory clash prevention
// Valid 2-hour lab blocks
// Cross-semester coordination
// Faculty workload balancing
// Minimum teacher calculation
// Saves generated timetable to Firestore
//
// Subjects are entered manually.
// No subject seeding is performed.
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


import {
  renderNavigation
} from "./layout.js";


// ============================================================
// FIRESTORE COLLECTIONS
// ============================================================

const subjectsCollection =
  collection(
    db,
    "subjects"
  );


const facultyCollection =
  collection(
    db,
    "faculty"
  );


const roomsCollection =
  collection(
    db,
    "rooms"
  );


const facultyAssignmentsCollection =
  collection(
    db,
    "facultyAssignments"
  );


const timetablesCollection =
  collection(
    db,
    "timetables"
  );


// ============================================================
// DAYS
// ============================================================

const DAYS = [

  "Monday",

  "Tuesday",

  "Wednesday",

  "Thursday",

  "Friday",

  "Saturday"

];


// ============================================================
// PERIODS
// ============================================================

const PERIODS = [

  {
    id: "P1",
    label: "P1",
    start: "10:30",
    end: "11:30",
    time: "10:30 - 11:30"
  },

  {
    id: "P2",
    label: "P2",
    start: "11:30",
    end: "12:30",
    time: "11:30 - 12:30"
  },

  {
    id: "P3",
    label: "P3",
    start: "12:30",
    end: "13:30",
    time: "12:30 - 1:30"
  },

  {
    id: "P4",
    label: "P4",
    start: "14:15",
    end: "15:15",
    time: "2:15 - 3:15"
  },

  {
    id: "P5",
    label: "P5",
    start: "15:30",
    end: "16:30",
    time: "3:30 - 4:30"
  },

  {
    id: "P6",
    label: "P6",
    start: "16:30",
    end: "17:30",
    time: "4:30 - 5:30"
  }

];


// ============================================================
// VALID 2-HOUR LAB BLOCKS
// ============================================================
//
// P4 + P5 is NOT allowed because tea break is between them.
// ============================================================

const LAB_BLOCKS = [

  ["P1", "P2"],

  ["P2", "P3"],

  ["P5", "P6"]

];


// ============================================================
// SETTINGS
// ============================================================

const MAX_GENERATION_ATTEMPTS = 120;


// ============================================================
// GLOBAL STATE
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

  renderNavigation();


  await requireAuthenticatedUser();


  const protectedContent =
    document.querySelector(
      "#protectedContent"
    );


  if (protectedContent) {

    protectedContent.removeAttribute(
      "hidden"
    );

  }


  enableSignOut();


  setupEvents();


  await loadData();


  updateWorkingDays();


  updateGenerationScopeUI();


  updateElectiveUI();


  updateRequirementSummary();

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {


  document
    .querySelectorAll(
      'input[name="generationScope"]'
    )
    .forEach(
      radio => {

        radio.addEventListener(
          "change",
          () => {

            updateGenerationScopeUI();

            updateElectiveUI();

            updateRequirementSummary();

          }
        );

      }
    );


  document
    .querySelector(
      "#academicYear"
    )
    ?.addEventListener(
      "change",
      () => {

        updateElectiveUI();

        updateRequirementSummary();

      }
    );


  document
    .querySelector(
      "#semester"
    )
    ?.addEventListener(
      "change",
      () => {

        updateElectiveUI();

        updateRequirementSummary();

      }
    );


  document
    .querySelectorAll(
      ".working-day"
    )
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
    .querySelector(
      "#electiveList"
    )
    ?.addEventListener(
      "change",
      () => {

        updateRequirementSummary();

      }
    );


  document
    .querySelector(
      "#generatorForm"
    )
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        generateTimetables();

      }
    );

}


// ============================================================
// LOAD FIRESTORE DATA
// ============================================================

async function loadData() {

  showStatus(
    "Loading subjects, faculty, assignments and rooms...",
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

      getDocs(
        subjectsCollection
      ),

      getDocs(
        facultyCollection
      ),

      getDocs(
        roomsCollection
      ),

      getDocs(
        facultyAssignmentsCollection
      ),

      getDocs(
        timetablesCollection
      )

    ]);


    // --------------------------------------------------------
    // SUBJECTS
    // --------------------------------------------------------

    allSubjects =
      subjectsSnapshot.docs
        .map(
          item => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .filter(
          subject =>
            subject.active !== false
        );


    // --------------------------------------------------------
    // FACULTY
    // --------------------------------------------------------

    allFaculty =
      facultySnapshot.docs
        .map(
          item => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .filter(
          member =>
            member.active !== false
        );


    // --------------------------------------------------------
    // ROOMS
    // --------------------------------------------------------

    allRooms =
      roomsSnapshot.docs
        .map(
          item => ({

            id:
              item.id,

            ...item.data()

          })
        )
        .filter(
          room => {

            const status =
              String(
                room.status ||
                "available"
              )
                .toLowerCase();


            return (
              status !== "inactive" &&
              status !== "unavailable"
            );

          }
        )
        .map(
          normalizeRoom
        );


    // --------------------------------------------------------
    // FACULTY ASSIGNMENTS
    // --------------------------------------------------------

    allFacultyAssignments =
      assignmentsSnapshot.docs
        .map(
          item => ({

            id:
              item.id,

            ...item.data()

          })
        );


    // --------------------------------------------------------
    // EXISTING TIMETABLES
    // --------------------------------------------------------

    existingTimetables =
      timetablesSnapshot.docs
        .map(
          item => ({

            id:
              item.id,

            ...item.data()

          })
        );


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


    showStatus(
      "Setup data loaded successfully.",
      "success"
    );


  } catch (error) {

    console.error(
      "Data loading error:",
      error
    );


    throw error;

  }

}


// ============================================================
// NORMALIZE ROOM
// ============================================================

function normalizeRoom(
  room
) {

  return {

    ...room,

    name:
      room.name ||
      room.roomName ||
      room.number ||
      room.id,

    type:
      String(
        room.type ||
        "classroom"
      )
        .trim()
        .toLowerCase(),

    capacity:
      Number(
        room.capacity ||
        0
      ),

    labType:
      room.labType ||
      "",

    batches:
      Array.isArray(
        room.batches
      )
        ? [
            ...room.batches
          ]
        : [],

    status:
      room.status ||
      "available"

  };

}


// ============================================================
// GENERATION SCOPE
// ============================================================

function getGenerationScope() {

  const selected =
    document.querySelector(
      'input[name="generationScope"]:checked'
    );


  return selected
    ? selected.value
    : "single";

}


// ============================================================
// UPDATE SCOPE UI
// ============================================================

function updateGenerationScopeUI() {

  const scope =
    getGenerationScope();


  const academicDetailsBox =
    document.querySelector(
      "#academicDetailsBox"
    );


  const yearSelect =
    document.querySelector(
      "#academicYear"
    );


  const semesterSelect =
    document.querySelector(
      "#semester"
    );


  if (
    scope === "single"
  ) {

    academicDetailsBox.style.display =
      "block";


    yearSelect.disabled =
      false;


    semesterSelect.disabled =
      false;


    return;

  }


  academicDetailsBox.style.display =
    "none";


  yearSelect.disabled =
    true;


  semesterSelect.disabled =
    true;

}


// ============================================================
// GET TARGET SEMESTERS
// ============================================================

function getTargetSemesters() {

  const scope =
    getGenerationScope();


  if (
    scope === "single"
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


    if (
      !year ||
      !semester
    ) {

      return [];

    }


    return [

      {

        year,

        semester,

        key:
          `${year}-${semester}`

      }

    ];

  }


  if (
    scope === "odd"
  ) {

    return [

      {
        year: "SE",
        semester: 3,
        key: "SE-3"
      },

      {
        year: "TE",
        semester: 5,
        key: "TE-5"
      },

      {
        year: "BE",
        semester: 7,
        key: "BE-7"
      }

    ];

  }


  return [

    {
      year: "SE",
      semester: 4,
      key: "SE-4"
    },

    {
      year: "TE",
      semester: 6,
      key: "TE-6"
    },

    {
      year: "BE",
      semester: 8,
      key: "BE-8"
    }

  ];

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
      .map(
        checkbox =>
          checkbox.value
      );

}


// ============================================================
// GET SEMESTER SUBJECTS
// ============================================================

function getSemesterSubjects(
  year,
  semester
) {

  return allSubjects.filter(
    subject => {

      const subjectYear =
        String(
          subject.year ||
          ""
        )
          .trim()
          .toUpperCase();


      return (

        subject.active !== false &&

        subjectYear ===
          String(
            year
          )
            .trim()
            .toUpperCase() &&

        Number(
          subject.semester
        ) ===
          Number(
            semester
          )

      );

    }
  );

}


// ============================================================
// ELECTIVE GROUP
// ============================================================

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


// ============================================================
// UPDATE ELECTIVE UI
// ============================================================

function updateElectiveUI() {

  const section =
    document.querySelector(
      "#electiveSection"
    );


  const container =
    document.querySelector(
      "#electiveList"
    );


  if (
    !section ||
    !container
  ) {

    return;

  }


  electiveGroups = {};


  container.innerHTML =
    "";


  const semesters =
    getTargetSemesters();


  if (
    semesters.length === 0
  ) {

    section.style.display =
      "none";

    return;

  }


  semesters.forEach(
    semesterInfo => {

      const subjects =
        getSemesterSubjects(
          semesterInfo.year,
          semesterInfo.semester
        );


      subjects.forEach(
        subject => {

          const group =
            getElectiveGroup(
              subject
            );


          if (!group) {

            return;

          }


          const key =
            `${semesterInfo.key}::${group}`;


          if (
            !electiveGroups[key]
          ) {

            electiveGroups[key] = {

              year:
                semesterInfo.year,

              semester:
                semesterInfo.semester,

              semesterKey:
                semesterInfo.key,

              group,

              subjects: []

            };

          }


          electiveGroups[key]
            .subjects
            .push(
              subject
            );

        }
      );

    }
  );


  const groups =
    Object.values(
      electiveGroups
    );


  if (
    groups.length === 0
  ) {

    section.style.display =
      "none";

    return;

  }


  section.style.display =
    "block";


  container.innerHTML =
    groups
      .map(
        groupInfo => {

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
                ${escapeHtml(
                  groupInfo.semesterKey
                )}
                —
                ${escapeHtml(
                  groupInfo.group
                )}
              </strong>


              <div
                style="
                  margin-top:12px;
                  display:grid;
                  gap:8px;
                "
              >

                ${groupInfo.subjects
                  .map(
                    (
                      subject,
                      index
                    ) => {

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
                            name="${escapeAttribute(
                              "elective_" +
                              groupInfo.semesterKey +
                              "_" +
                              groupInfo.group
                            )}"
                            value="${escapeAttribute(
                              subject.id
                            )}"
                            class="elective-option"
                            data-group="${escapeAttribute(
                              groupInfo.group
                            )}"
                            data-semester-key="${escapeAttribute(
                              groupInfo.semesterKey
                            )}"
                            ${
                              index === 0
                                ? "checked"
                                : ""
                            }
                          >


                          <span>

                            <strong>
                              ${escapeHtml(
                                subject.name ||
                                subject.subjectName ||
                                subject.id
                              )}
                            </strong>


                            <br>


                            <small>

                              L${getLectureHours(
                                subject
                              )}

                              T${getTutorialHours(
                                subject
                              )}

                              P${getPracticalHours(
                                subject
                              )}

                            </small>

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
// SELECTED ELECTIVES
// ============================================================

function getSelectedElectiveIds() {

  const selected =
    new Set();


  document
    .querySelectorAll(
      '#electiveList input[type="radio"]:checked'
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


// ============================================================
// IS SUBJECT SCHEDULED?
// ============================================================

function isSubjectSelected(
  subject,
  selectedElectives
) {

  const group =
    getElectiveGroup(
      subject
    );


  if (!group) {

    return true;

  }


  return selectedElectives.has(
    subject.id
  );

}


// ============================================================
// GET SELECTED SUBJECTS
// ============================================================

function getSelectedSubjects(
  semesterInfo
) {

  const subjects =
    getSemesterSubjects(
      semesterInfo.year,
      semesterInfo.semester
    );


  const selectedElectives =
    getSelectedElectiveIds();


  return subjects.filter(
    subject =>
      isSubjectSelected(
        subject,
        selectedElectives
      )
  );

}


// ============================================================
// GET L/T/P
// ============================================================

function getLectureHours(
  subject
) {

  return numberValue(
    subject.lectureHours ??
    subject.lecture ??
    subject.L ??
    subject.l ??
    0
  );

}


function getTutorialHours(
  subject
) {

  return numberValue(
    subject.tutorialHours ??
    subject.tutorial ??
    subject.T ??
    subject.t ??
    0
  );

}


function getPracticalHours(
  subject
) {

  return numberValue(
    subject.practicalHours ??
    subject.practical ??
    subject.P ??
    subject.p ??
    0
  );

}


// ============================================================
// CALCULATE LOAD
// ============================================================

function calculateLoad(
  subjects
) {

  let L = 0;

  let T = 0;

  let P = 0;


  subjects.forEach(
    subject => {

      L +=
        getLectureHours(
          subject
        );


      T +=
        getTutorialHours(
          subject
        );


      P +=
        getPracticalHours(
          subject
        );

    }
  );


  return {

    L,

    T,

    P,

    total:
      L +
      T +
      P

  };

}


// ============================================================
// UPDATE REQUIREMENT SUMMARY
// ============================================================

function updateRequirementSummary() {

  const summary =
    document.querySelector(
      "#requirementSummary"
    );


  const semesters =
    getTargetSemesters();


  if (
    semesters.length === 0
  ) {

    summary.style.display =
      "none";

    return;

  }


  summary.style.display =
    "block";


  /*
   * For single semester the original four
   * summary fields are used.
   *
   * For multi-semester mode we show totals.
   */

  let totalL = 0;

  let totalT = 0;

  let totalP = 0;


  semesters.forEach(
    semesterInfo => {

      const subjects =
        getSelectedSubjects(
          semesterInfo
        );


      const load =
        calculateLoad(
          subjects
        );


      totalL += load.L;

      totalT += load.T;

      totalP += load.P;

    }
  );


  setText(
    "#requiredLectures",
    totalL
  );


  setText(
    "#requiredTutorials",
    totalT
  );


  setText(
    "#requiredPracticals",
    totalP
  );


  setText(
    "#requiredTotal",
    totalL +
    totalT +
    totalP
  );


  updateTeacherRequirementSummary(
    semesters
  );

}


// ============================================================
// TEACHER REQUIREMENT SUMMARY
// ============================================================
//
// Uses the actual faculty uploaded into Firestore.
//
// Minimum teachers are calculated from:
//     required weekly periods
//     +
//     faculty workloadLimit
//
// Faculty are taken from facultyAssignments for
// the selected year + semester.
// ============================================================

function updateTeacherRequirementSummary(
  semesters
) {

  const container =
    document.querySelector(
      "#teacherRequirementSummary"
    );


  if (!container) {
    return;
  }


  container.innerHTML = "";


  semesters.forEach(
    semesterInfo => {

      const subjects =
        getSelectedSubjects(
          semesterInfo
        );


      const load =
        calculateLoad(
          subjects
        );


      const teacherInfo =
        getTeacherRequirement(
          semesterInfo,
          subjects
        );


      const teacherList =
        teacherInfo.assignedTeachers
          .map(
            teacher => {

              const limit =
                getFacultyWorkloadLimit(
                  teacher
                );


              return `

                <li>

                  ${escapeHtml(
                    teacher.name ||
                    teacher.employeeId ||
                    teacher.id
                  )}

                  <small>
                    —
                    ${limit}
                    periods/week
                  </small>

                </li>

              `;

            }
          )
          .join("");


      let messageHtml = "";


      if (
        teacherInfo.assignedCount === 0
      ) {

        messageHtml = `

          <div class="teacher-warning">

            ⚠ No teachers are assigned to
            ${escapeHtml(
              semesterInfo.key
            )} through Subject Assignment.

          </div>

        `;

      } else if (
        teacherInfo.totalAssignedCapacity <
        load.total
      ) {

        messageHtml = `

          <div class="teacher-warning">

            ⚠ Assigned faculty capacity is
            ${teacherInfo.totalAssignedCapacity}
            periods/week, but this semester
            requires ${load.total}
            periods/week.

          </div>

        `;

      } else {

        messageHtml = `

          <div class="teacher-success">

            ✓ Assigned faculty capacity is sufficient
            for the weekly requirement.

          </div>

        `;

      }


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "teacher-semester-card";


      card.innerHTML = `

        <div class="teacher-semester-title">

          ${escapeHtml(
            semesterInfo.key
          )}

        </div>


        <div class="teacher-stats">


          <div class="teacher-stat">

            <small>
              Weekly Periods
            </small>

            <strong>
              ${load.total}
            </strong>

          </div>


          <div class="teacher-stat">

            <small>
              Teachers Assigned
            </small>

            <strong>
              ${teacherInfo.assignedCount}
            </strong>

          </div>


          <div class="teacher-stat">

            <small>
              Minimum Teachers Required
            </small>

            <strong>
              ${teacherInfo.minimumRequired}
            </strong>

          </div>


          <div class="teacher-stat">

            <small>
              Assigned Capacity
            </small>

            <strong>
              ${teacherInfo.totalAssignedCapacity}
            </strong>

          </div>


        </div>


        <div class="teacher-list">

          <div class="teacher-list-title">

            Teachers assigned from Faculty Assignment:

          </div>


          ${
            teacherList
              ? `
                <ul>
                  ${teacherList}
                </ul>
              `
              : `
                <div class="teacher-neutral">
                  No assigned teachers found.
                </div>
              `
          }


        </div>


        ${messageHtml}

      `;


      container.appendChild(
        card
      );

    }
  );

}


// ============================================================
// TEACHER REQUIREMENT
// ============================================================

function getTeacherRequirement(
  semesterInfo,
  subjects
) {

  const facultyIds =
    new Set();


  const subjectIds =
    new Set(
      subjects.map(
        subject =>
          subject.id
      )
    );


  /*
   * Read facultyAssignments.
   *
   * Preferred structure:
   *
   * assignments: [
   *   {
   *      subjectId,
   *      year,
   *      semester
   *   }
   * ]
   */

  allFacultyAssignments.forEach(
    assignmentDoc => {

      if (
        !assignmentDoc.facultyId
      ) {

        return;

      }


      const nestedAssignments =
        Array.isArray(
          assignmentDoc.assignments
        )
          ? assignmentDoc.assignments
          : [];


      nestedAssignments.forEach(
        assignment => {

          const year =
            normalizeYear(
              assignment.year
            );


          const semester =
            Number(
              assignment.semester
            );


          if (

            year ===
              normalizeYear(
                semesterInfo.year
              )

            &&

            semester ===
              Number(
                semesterInfo.semester
              )

            &&

            subjectIds.has(
              assignment.subjectId
            )

          ) {

            facultyIds.add(
              assignmentDoc.facultyId
            );

          }

        }
      );


      /*
       * Backward-compatible subjectIds support.
       *
       * If a faculty document has subjectIds but
       * no semester information, it is considered
       * assigned to the subject.
       */

      const subjectIdsArray =
        Array.isArray(
          assignmentDoc.subjectIds
        )
          ? assignmentDoc.subjectIds
          : [];


      if (
        nestedAssignments.length === 0
      ) {

        subjectIdsArray.forEach(
          subjectId => {

            if (
              subjectIds.has(
                subjectId
              )
            ) {

              facultyIds.add(
                assignmentDoc.facultyId
              );

            }

          }
        );

      }

    }
  );


  const assignedTeachers =
    Array.from(
      facultyIds
    )
      .map(
        facultyId =>
          allFaculty.find(
            faculty =>
              faculty.id ===
              facultyId
          )
      )
      .filter(
        Boolean
      );


  /*
   * Sort highest workload first.
   */

  const sortedTeachers =
    [
      ...assignedTeachers
    ]
      .sort(
        (a, b) =>
          getFacultyWorkloadLimit(b) -
          getFacultyWorkloadLimit(a)
      );


  /*
   * Minimum number of assigned teachers
   * needed to cover the weekly load.
   *
   * Example:
   *
   * Required = 26
   *
   * Teacher A = 18
   * Teacher B = 18
   *
   * 18 + 18 >= 26
   *
   * Minimum = 2
   */

  let capacity = 0;

  let minimumRequired = 0;


  const weeklyLoad =
    calculateLoad(
      subjects
    ).total;


  for (
    const teacher
    of sortedTeachers
  ) {

    capacity +=
      getFacultyWorkloadLimit(
        teacher
      );


    minimumRequired++;


    if (
      capacity >=
      weeklyLoad
    ) {

      break;

    }

  }


  /*
   * If assigned teachers do not cover the load,
   * calculate the theoretical minimum from all
   * uploaded faculty workload limits.
   */

  if (
    capacity <
    weeklyLoad
  ) {

    const allCapacities =
      allFaculty
        .map(
          faculty =>
            getFacultyWorkloadLimit(
              faculty
            )
        )
        .sort(
          (a, b) =>
            b - a
        );


    let theoreticalCapacity = 0;

    let theoreticalMinimum = 0;


    for (
      const value
      of allCapacities
    ) {

      theoreticalCapacity +=
        value;

      theoreticalMinimum++;


      if (
        theoreticalCapacity >=
        weeklyLoad
      ) {

        break;

      }

    }


    minimumRequired =
      Math.max(
        minimumRequired,
        theoreticalMinimum
      );

  }


  return {

    assignedTeachers:
      sortedTeachers,

    assignedCount:
      sortedTeachers.length,

    minimumRequired,

    totalAssignedCapacity:
      sortedTeachers.reduce(
        (
          total,
          teacher
        ) =>
          total +
          getFacultyWorkloadLimit(
            teacher
          ),
        0
      )

  };

}


// ============================================================
// FACULTY WORKLOAD LIMIT
// ============================================================

function getFacultyWorkloadLimit(
  faculty
) {

  const value =
    Number(
      faculty.workloadLimit
    );


  if (
    Number.isFinite(value) &&
    value > 0
  ) {

    return value;

  }


  /*
   * Existing faculty records should normally
   * contain workloadLimit.
   *
   * 18 is only a safe fallback if missing.
   */

  return 18;

}


// ============================================================
// VALIDATE ELECTIVE SELECTIONS
// ============================================================

function validateElectiveSelections(
  semesters
) {

  const selected =
    getSelectedElectiveIds();


  for (
    const semesterInfo
    of semesters
  ) {

    const subjects =
      getSemesterSubjects(
        semesterInfo.year,
        semesterInfo.semester
      );


    const groups =
      new Map();


    subjects.forEach(
      subject => {

        const group =
          getElectiveGroup(
            subject
          );


        if (!group) {
          return;
        }


        if (
          !groups.has(group)
        ) {

          groups.set(
            group,
            []
          );

        }


        groups
          .get(group)
          .push(
            subject
          );

      }
    );


    for (
      const [
        group,
        groupSubjects
      ]
      of groups
    ) {

      if (
        groupSubjects.length <= 1
      ) {

        continue;

      }


      const selectedFromGroup =
        groupSubjects.some(
          subject =>
            selected.has(
              subject.id
            )
        );


      if (
        !selectedFromGroup
      ) {

        throw new Error(

          `Please select one option from ` +
          `${semesterInfo.key} — ${group}.`

        );

      }

    }

  }

}


// ============================================================
// VALIDATE ASSIGNMENTS
// ============================================================

function validateSubjectAssignments(
  semesters
) {

  const missing = [];


  semesters.forEach(
    semesterInfo => {

      const subjects =
        getSelectedSubjects(
          semesterInfo
        );


      subjects.forEach(
        subject => {

          const assigned =
            getAssignedFaculty(
              subject.id,
              semesterInfo.year,
              semesterInfo.semester
            );


          if (
            assigned.length === 0
          ) {

            missing.push(

              `${semesterInfo.key}: ` +
              `${subject.name || subject.id}`

            );

          }

        }
      );

    }
  );


  if (
    missing.length
  ) {

    throw new Error(

      "No faculty assigned for:<br><br>" +

      missing
        .map(
          item =>
            `• ${escapeHtml(item)}`
        )
        .join("<br>") +

      "<br><br>" +

      "Go to Subject Assignment and assign " +
      "faculty before generating."

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
    assignmentDoc => {

      const facultyId =
        assignmentDoc.facultyId;


      if (!facultyId) {
        return;
      }


      /*
       * Nested assignments.
       */

      const assignments =
        Array.isArray(
          assignmentDoc.assignments
        )
          ? assignmentDoc.assignments
          : [];


      assignments.forEach(
        assignment => {

          if (
            assignment.subjectId !==
            subjectId
          ) {

            return;

          }


          const assignmentYear =
            normalizeYear(
              assignment.year
            );


          const requestedYear =
            normalizeYear(
              year
            );


          const assignmentSemester =
            Number(
              assignment.semester
            );


          if (

            assignmentYear ===
              requestedYear

            &&

            assignmentSemester ===
              Number(
                semester
              )

          ) {

            facultyIds.add(
              facultyId
            );

          }

        }
      );


      /*
       * Backward-compatible format:
       *
       * facultyAssignments:
       * {
       *   facultyId,
       *   subjectIds: [...]
       * }
       *
       * If year/semester are absent from the
       * document, subjectIds is treated as the
       * assignment.
       */

      const subjectIds =
        Array.isArray(
          assignmentDoc.subjectIds
        )
          ? assignmentDoc.subjectIds
          : [];


      if (
        subjectIds.includes(
          subjectId
        ) &&
        assignments.length === 0
      ) {

        facultyIds.add(
          facultyId
        );

      }

    }
  );


  return Array.from(
    facultyIds
  )
    .map(
      facultyId =>
        allFaculty.find(
          faculty =>
            faculty.id ===
            facultyId
        )
    )
    .filter(
      Boolean
    );

}


// ============================================================
// CREATE ALL TASKS
// ============================================================

function createTasks(
  semesters
) {

  const tasks = [];


  semesters.forEach(
    semesterInfo => {

      const subjects =
        getSelectedSubjects(
          semesterInfo
        );


      subjects.forEach(
        subject => {

          const lectureHours =
            getLectureHours(
              subject
            );


          const tutorialHours =
            getTutorialHours(
              subject
            );


          const practicalHours =
            getPracticalHours(
              subject
            );


          /*
           * -----------------------------------------------
           * LECTURES
           * -----------------------------------------------
           */

          for (
            let i = 0;
            i < lectureHours;
            i++
          ) {

            tasks.push({

              id:
                `${semesterInfo.key}-` +
                `${subject.id}-L-${i}`,

              subjectId:
                subject.id,

              subjectName:
                subject.name ||
                subject.subjectName ||
                subject.id,

              subjectCode:
                subject.code ||
                "",

              year:
                semesterInfo.year,

              semester:
                semesterInfo.semester,

              semesterKey:
                semesterInfo.key,

              type:
                "lecture",

              duration:
                1,

              priority:
                4

            });

          }


          /*
           * -----------------------------------------------
           * TUTORIALS
           * -----------------------------------------------
           */

          for (
            let i = 0;
            i < tutorialHours;
            i++
          ) {

            tasks.push({

              id:
                `${semesterInfo.key}-` +
                `${subject.id}-T-${i}`,

              subjectId:
                subject.id,

              subjectName:
                subject.name ||
                subject.subjectName ||
                subject.id,

              subjectCode:
                subject.code ||
                "",

              year:
                semesterInfo.year,

              semester:
                semesterInfo.semester,

              semesterKey:
                semesterInfo.key,

              type:
                "tutorial",

              duration:
                1,

              priority:
                5

            });

          }


          /*
           * -----------------------------------------------
           * PRACTICALS
           * -----------------------------------------------
           *
           * P4 + P5 is not allowed.
           *
           * Practical hours are converted into
           * 2-hour lab blocks.
           */

          let remaining =
            practicalHours;


          let labNumber =
            1;


          while (
            remaining >= 2
          ) {

            let type =
              "lab";


            const subjectType =
              String(
                subject.type ||
                ""
              )
                .trim()
                .toLowerCase();


            if (
              subjectType ===
              "project"
            ) {

              type =
                "project";

            }


            if (
              subjectType ===
              "seminar"
            ) {

              type =
                "seminar";

            }


            tasks.push({

              id:
                `${semesterInfo.key}-` +
                `${subject.id}-P-${labNumber}`,

              subjectId:
                subject.id,

              subjectName:
                subject.name ||
                subject.subjectName ||
                subject.id,

              subjectCode:
                subject.code ||
                "",

              year:
                semesterInfo.year,

              semester:
                semesterInfo.semester,

              semesterKey:
                semesterInfo.key,

              type,

              duration:
                2,

              priority:
                type === "lab"
                  ? 1
                  : 2,

              batches:
                Array.isArray(
                  subject.batches
                )
                  ? [
                      ...subject.batches
                    ]
                  : []

            });


            remaining -=
              2;


            labNumber++;

          }


          /*
           * -----------------------------------------------
           * ODD PRACTICAL HOUR
           * -----------------------------------------------
           */

          if (
            remaining === 1
          ) {

            let type =
              "lab";


            const subjectType =
              String(
                subject.type ||
                ""
              )
                .trim()
                .toLowerCase();


            if (
              subjectType ===
              "project"
            ) {

              type =
                "project";

            }


            if (
              subjectType ===
              "seminar"
            ) {

              type =
                "seminar";

            }


            tasks.push({

              id:
                `${semesterInfo.key}-` +
                `${subject.id}-P-${labNumber}`,

              subjectId:
                subject.id,

              subjectName:
                subject.name ||
                subject.subjectName ||
                subject.id,

              subjectCode:
                subject.code ||
                "",

              year:
                semesterInfo.year,

              semester:
                semesterInfo.semester,

              semesterKey:
                semesterInfo.key,

              type,

              duration:
                1,

              priority:
                3

            });

          }

        }
      );

    }
  );


  /*
   * Harder tasks first.
   */

  tasks.sort(
    (a, b) => {

      if (
        b.duration !==
        a.duration
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


  return tasks;

}


// ============================================================
// GLOBAL GENERATION
// ============================================================

function createGlobalSchedule(
  tasks,
  semesters
) {

  /*
   * Existing timetable occupancy.
   *
   * These are copied into Sets and then the
   * new semesters are scheduled around them.
   */

  const external =
    buildExternalOccupancy(
      semesters
    );


  const facultyBusy =
    new Set(
      external.facultyBusy
    );


  const roomBusy =
    new Set(
      external.roomBusy
    );


  const cohortBusy =
    new Set();


  const entries = [];


  /*
   * Faculty workload includes existing
   * timetable workload.
   */

  const facultyWorkload =
    new Map();


  allFaculty.forEach(
    faculty => {

      facultyWorkload.set(
        faculty.id,
        0
      );

    }
  );


  external.existingEntries
    .forEach(
      entry => {

        if (
          !entry.facultyId
        ) {

          return;

        }


        const periods =
          getEntryPeriods(
            entry
          );


        facultyWorkload.set(

          entry.facultyId,

          (
            facultyWorkload.get(
              entry.facultyId
            ) || 0
          ) +
          periods.length

        );

      }
    );


  const roomUsage =
    new Map();


  allRooms.forEach(
    room => {

      roomUsage.set(
        room.id,
        0
      );

    }
  );


  external.existingEntries
    .forEach(
      entry => {

        if (
          !entry.roomId
        ) {

          return;

        }


        const periods =
          getEntryPeriods(
            entry
          );


        roomUsage.set(

          entry.roomId,

          (
            roomUsage.get(
              entry.roomId
            ) || 0
          ) +
          periods.length

        );

      }
    );


  /*
   * Randomize only to create different
   * valid schedules between attempts.
   */

  const orderedTasks =
    shuffle(
      [...tasks]
    );


  /*
   * Labs first.
   */

  orderedTasks.sort(
    (a, b) => {

      if (
        b.duration !==
        a.duration
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


  for (
    const task
    of orderedTasks
  ) {

    const candidates =
      findCandidates(

        task,

        facultyBusy,

        roomBusy,

        cohortBusy,

        facultyWorkload,

        roomUsage

      );


    if (
      candidates.length === 0
    ) {

      return {

        success:
          false,

        message:
          getTaskFailureMessage(
            task
          ),

        entries

      };

    }


    /*
     * Prefer:
     *
     * 1. lower faculty workload
     * 2. lower room usage
     * 3. random
     */

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


        if (
          a.roomUsage !==
          b.roomUsage
        ) {

          return (
            a.roomUsage -
            b.roomUsage
          );

        }


        return (
          Math.random() -
          0.5
        );

      }
    );


    /*
     * Choose first candidate.
     */

    const selected =
      candidates[0];


    /*
     * Reserve every period.
     */

    selected.periodIds
      .forEach(
        periodId => {

          cohortBusy.add(

            getClassKey(
              task.semesterKey,
              selected.day,
              periodId
            )

          );


          facultyBusy.add(

            getFacultyKey(
              selected.faculty.id,
              selected.day,
              periodId
            )

          );


          roomBusy.add(

            getRoomKey(
              selected.room.id,
              selected.day,
              periodId
            )

          );

        }
      );


    /*
     * Faculty workload.
     */

    facultyWorkload.set(

      selected.faculty.id,

      (
        facultyWorkload.get(
          selected.faculty.id
        ) || 0
      ) +
      selected.periodIds.length

    );


    /*
     * Room usage.
     */

    roomUsage.set(

      selected.room.id,

      (
        roomUsage.get(
          selected.room.id
        ) || 0
      ) +
      selected.periodIds.length

    );


    /*
     * Time information.
     */

    const firstPeriod =
      PERIODS.find(
        period =>
          period.id ===
          selected.periodIds[0]
      );


    const lastPeriod =
      PERIODS.find(
        period =>
          period.id ===
          selected.periodIds[
            selected.periodIds.length - 1
          ]
      );


    /*
     * Save one entry for whole block.
     */

    entries.push({

      id:
        `${task.id}_` +
        `${selected.day}_` +
        `${selected.periodIds[0]}`,

      subjectId:
        task.subjectId,

      subjectName:
        task.subjectName,

      subjectCode:
        task.subjectCode,

      year:
        task.year,

      semester:
        task.semester,

      semesterKey:
        task.semesterKey,

      type:
        task.type,

      day:
        selected.day,

      periods:
        [
          ...selected.periodIds
        ],

      startTime:
        firstPeriod?.start ||
        "",

      endTime:
        lastPeriod?.end ||
        "",

      facultyId:
        selected.faculty.id,

      facultyName:
        selected.faculty.name,

      roomId:
        selected.room.id,

      roomName:
        selected.room.name,

      roomType:
        selected.room.type,

      labType:
        selected.room.labType ||
        "",

      batches:
        selected.room.type ===
        "lab"
          ? (
              Array.isArray(
                selected.room.batches
              )
                ? [
                    ...selected.room.batches
                  ]
                : []
            )
          : [],

      taskId:
        task.id

    });

  }


  /*
   * Final validation.
   */

  const validation =
    validateFinalSchedule(
      entries
    );


  if (
    !validation.valid
  ) {

    return {

      success:
        false,

      message:
        validation.reason,

      entries

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
  facultyBusy,
  roomBusy,
  cohortBusy,
  facultyWorkload,
  roomUsage
) {

  const candidates = [];


  const assignedFaculty =
    getAssignedFaculty(

      task.subjectId,

      task.year,

      task.semester

    );


  if (
    assignedFaculty.length === 0
  ) {

    return candidates;

  }


  /*
   * Suitable rooms.
   */

  const suitableRooms =
    allRooms.filter(
      room => {

        const type =
          String(
            room.type ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          task.type ===
          "lab"
        ) {

          return (
            type ===
            "lab"
          );

        }


        /*
         * Projects and seminars may use
         * classroom or lab.
         */

        if (
          task.type ===
          "project"
          ||
          task.type ===
          "seminar"
        ) {

          return (

            type ===
            "classroom"

            ||

            type ===
            "lab"

          );

        }


        /*
         * Theory/tutorial use classroom.
         */

        return (
          type ===
          "classroom"
        );

      }
    );


  if (
    suitableRooms.length === 0
  ) {

    return candidates;

  }


  /*
   * Random day order.
   */

  const days =
    shuffle(
      [
        ...selectedWorkingDays
      ]
    );


  for (
    const day
    of days
  ) {

    /*
     * Check faculty availability.
     */

    const dayFaculty =
      assignedFaculty.filter(
        faculty => {

          const availableDays =
            Array.isArray(
              faculty.availableDays
            )
              ? faculty.availableDays
              : [];


          /*
           * Empty availability means all days.
           */

          if (
            availableDays.length ===
            0
          ) {

            return true;

          }


          return (
            availableDays.includes(
              day
            )
          );

        }
      );


    if (
      dayFaculty.length === 0
    ) {

      continue;

    }


    /*
     * Period options.
     */

    let periodOptions;


    if (
      task.duration === 2
    ) {

      periodOptions =
        LAB_BLOCKS.map(
          block =>
            [
              ...block
            ]
        );

    } else {

      periodOptions =
        PERIODS.map(
          period =>
            [
              period.id
            ]
        );

    }


    periodOptions =
      shuffle(
        periodOptions
      );


    /*
     * Period loop.
     */

    for (
      const periodIds
      of periodOptions
    ) {


      /*
       * Student/cohort clash.
       */

      const cohortAvailable =
        periodIds.every(
          periodId =>
            !cohortBusy.has(

              getClassKey(
                task.semesterKey,
                day,
                periodId
              )

            )
        );


      if (
        !cohortAvailable
      ) {

        continue;

      }


      /*
       * Faculty candidates.
       */

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
        facultyCandidates.length ===
        0
      ) {

        continue;

      }


      /*
       * Room candidates.
       */

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
        roomCandidates.length ===
        0
      ) {

        continue;

      }


      /*
       * Faculty + room combinations.
       */

      facultyCandidates.forEach(
        faculty => {

          roomCandidates.forEach(
            room => {

              candidates.push({

                day,

                periodIds:
                  [
                    ...periodIds
                  ],

                faculty,

                room,

                facultyWorkload:
                  facultyWorkload.get(
                    faculty.id
                  ) || 0,

                roomUsage:
                  roomUsage.get(
                    room.id
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
// EXTERNAL OCCUPANCY
// ============================================================
//
// Existing timetables belonging to the semesters being
// regenerated are ignored.
//
// Example:
//
// Odd generation:
//
// SE-3
// TE-5
// BE-7
//
// Existing SE-3/TE-5/BE-7 are ignored.
// Other timetable documents remain blocked.
// ============================================================

function buildExternalOccupancy(
  targetSemesters
) {

  const facultyBusy =
    new Set();


  const roomBusy =
    new Set();


  const existingEntries =
    [];


  const targetKeys =
    new Set(
      targetSemesters.map(
        semesterInfo =>
          semesterInfo.key
      )
    );


  existingTimetables.forEach(
    timetable => {

      const timetableKey =
        getTimetableKey(
          timetable
        );


      /*
       * Do not block target semesters.
       */

      if (
        targetKeys.has(
          timetableKey
        )
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


          if (
            periods.length ===
            0
          ) {

            return;

          }


          existingEntries.push(
            entry
          );


          periods.forEach(
            periodId => {


              /*
               * Faculty.
               */

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


              /*
               * Room.
               */

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

    roomBusy,

    existingEntries

  };

}


// ============================================================
// TIMETABLE KEY
// ============================================================

function getTimetableKey(
  timetable
) {

  if (
    timetable.semesterKey
  ) {

    return String(
      timetable.semesterKey
    );

  }


  if (
    timetable.year !== undefined &&
    timetable.semester !== undefined
  ) {

    return (

      `${normalizeYear(
        timetable.year
      )}-${Number(
        timetable.semester
      )}`

    );

  }


  return "";

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
    )
  ) {

    return [
      ...entry.periods
    ];

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
// FINAL VALIDATION
// ============================================================

function validateFinalSchedule(
  entries
) {

  const facultyBusy =
    new Set();


  const roomBusy =
    new Set();


  const cohortBusy =
    new Set();


  for (
    const entry
    of entries
  ) {

    const periods =
      getEntryPeriods(
        entry
      );


    for (
      const periodId
      of periods
    ) {


      /*
       * Faculty clash.
       */

      const facultyKey =
        getFacultyKey(
          entry.facultyId,
          entry.day,
          periodId
        );


      if (
        facultyBusy.has(
          facultyKey
        )
      ) {

        return {

          valid:
            false,

          reason:

            `Faculty clash for ` +
            `${entry.facultyName || entry.facultyId} ` +
            `on ${entry.day} ${periodId}.`

        };

      }


      facultyBusy.add(
        facultyKey
      );


      /*
       * Room clash.
       */

      const roomKey =
        getRoomKey(
          entry.roomId,
          entry.day,
          periodId
        );


      if (
        roomBusy.has(
          roomKey
        )
      ) {

        return {

          valid:
            false,

          reason:

            `Room clash for ` +
            `${entry.roomName || entry.roomId} ` +
            `on ${entry.day} ${periodId}.`

        };

      }


      roomBusy.add(
        roomKey
      );


      /*
       * Student/cohort clash.
       */

      const cohortKey =
        getClassKey(
          entry.semesterKey ||
          `${entry.year}-${entry.semester}`,
          entry.day,
          periodId
        );


      if (
        cohortBusy.has(
          cohortKey
        )
      ) {

        return {

          valid:
            false,

          reason:

            `Student/cohort clash for ` +
            `${entry.year}-${entry.semester} ` +
            `on ${entry.day} ${periodId}.`

        };

      }


      cohortBusy.add(
        cohortKey
      );

    }

  }


  return {

    valid:
      true

  };

}


// ============================================================
// GENERATE TIMETABLES
// ============================================================

async function generateTimetables() {

  const button =
    document.querySelector(
      "#generateButton"
    );


  try {

    clearMessage();


    updateWorkingDays();


    if (
      selectedWorkingDays.length ===
      0
    ) {

      throw new Error(
        "Select at least one working day."
      );

    }


    const semesters =
      getTargetSemesters();


    if (
      semesters.length ===
      0
    ) {

      throw new Error(
        "Please select an academic year and semester."
      );

    }


    validateElectiveSelections(
      semesters
    );


    /*
     * Check that every target semester has subjects.
     */

    for (
      const semesterInfo
      of semesters
    ) {

      const subjects =
        getSelectedSubjects(
          semesterInfo
        );


      if (
        subjects.length ===
        0
      ) {

        throw new Error(

          `No subjects found for ` +
          `${semesterInfo.key}.`

        );

      }

    }


    /*
     * Validate assignments.
     */

    validateSubjectAssignments(
      semesters
    );


    /*
     * Calculate total periods.
     */

    let totalRequired =
      0;


    semesters.forEach(
      semesterInfo => {

        const subjects =
          getSelectedSubjects(
            semesterInfo
          );


        totalRequired +=
          calculateLoad(
            subjects
          ).total;

      }
    );


    const availableStudentPeriods =
      semesters.length *
      selectedWorkingDays.length *
      PERIODS.length;


    if (
      totalRequired >
      availableStudentPeriods
    ) {

      throw new Error(

        `Required ${totalRequired} periods, ` +
        `but only ${availableStudentPeriods} student periods ` +
        `are available.`

      );

    }


    if (button) {

      button.disabled =
        true;

      button.textContent =
        "Generating...";

    }


    showStatus(

      `Preparing timetable for ` +
      `${semesters.map(
        item => item.key
      ).join(", ")}...`,

      "info"

    );


    const tasks =
      createTasks(
        semesters
      );


    if (
      tasks.length ===
      0
    ) {

      throw new Error(
        "No scheduling tasks were created."
      );

    }


    let result =
      null;


    let lastMessage =
      "";


    /*
     * Multiple attempts.
     */

    for (
      let attempt = 1;
      attempt <=
      MAX_GENERATION_ATTEMPTS;
      attempt++
    ) {

      showStatus(

        `Generating timetable... ` +
        `Attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}`,

        "info"

      );


      result =
        createGlobalSchedule(
          tasks,
          semesters
        );


      if (
        result.success
      ) {

        break;

      }


      lastMessage =
        result.message ||
        "";

    }


    if (
      !result ||
      !result.success
    ) {

      throw new Error(

        lastMessage ||

        "Unable to generate a conflict-free timetable. " +

        "Check faculty assignments, faculty availability, " +

        "rooms/labs and working days."

      );

    }


    /*
     * Save all selected semesters.
     */

    showStatus(
      "Saving generated timetables...",
      "info"
    );


    await saveGeneratedTimetables(
      result.entries,
      semesters
    );


    /*
     * Update local timetable cache.
     */

    semesters.forEach(
      semesterInfo => {

        const entries =
          result.entries.filter(
            entry =>
              entry.semesterKey ===
              semesterInfo.key
          );


        existingTimetables =
          existingTimetables.filter(
            timetable =>
              getTimetableKey(
                timetable
              ) !==
              semesterInfo.key
          );


        existingTimetables.push({

          id:
            `${semesterInfo.year}_${semesterInfo.semester}`,

          year:
            semesterInfo.year,

          semester:
            semesterInfo.semester,

          semesterKey:
            semesterInfo.key,

          entries

        });

      }
    );


    /*
     * Result.
     */

    renderGenerationResult(
      result.entries,
      semesters
    );


    showStatus(

      `Timetable generated successfully. ` +
      `${result.entries.length} teaching blocks scheduled.`,

      "success"

    );


    showMessage(

      `Timetable generated successfully for ` +
      `${semesters
        .map(
          item =>
            item.key
        )
        .join(", ")}. ` +

      `Cross-semester faculty, room and cohort ` +
      `coordination is enabled.`,

      "success"

    );


  } catch (error) {

    console.error(
      "Timetable generation error:",
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

      button.disabled =
        false;

      button.textContent =
        "Generate Timetable";

    }

  }

}


// ============================================================
// SAVE GENERATED TIMETABLES
// ============================================================

async function saveGeneratedTimetables(
  entries,
  semesters
) {

  for (
    const semesterInfo
    of semesters
  ) {

    const semesterEntries =
      entries.filter(
        entry =>
          entry.semesterKey ===
          semesterInfo.key
      );


    const load =
      calculateLoad(
        getSelectedSubjects(
          semesterInfo
        )
      );


    const teacherInfo =
      getTeacherRequirement(
        semesterInfo,
        getSelectedSubjects(
          semesterInfo
        )
      );


    const timetableId =
      `${semesterInfo.year}_${semesterInfo.semester}`;


    await setDoc(

      doc(
        db,
        "timetables",
        timetableId
      ),

      {

        year:
          semesterInfo.year,

        semester:
          semesterInfo.semester,

        semesterKey:
          semesterInfo.key,

        workingDays:
          [
            ...selectedWorkingDays
          ],

        periods:
          PERIODS,

        load,

        entries:
          semesterEntries,

        generatedAt:
          serverTimestamp(),

        generationInfo: {

          coordinated:
            true,

          generationScope:
            getGenerationScope(),

          totalSubjects:
            getSelectedSubjects(
              semesterInfo
            ).length,

          totalBlocks:
            semesterEntries.length,

          facultyCount:
            teacherInfo.assignedCount,

          minimumTeachersRequired:
            teacherInfo.minimumRequired,

          assignedFacultyCapacity:
            teacherInfo.totalAssignedCapacity,

          roomCount:
            allRooms.length,

          labCount:
            allRooms.filter(
              room =>
                room.type ===
                "lab"
            ).length

        }

      }

    );

  }

}


// ============================================================
// FAILURE MESSAGE
// ============================================================

function getTaskFailureMessage(
  task
) {

  const assignedFaculty =
    getAssignedFaculty(
      task.subjectId,
      task.year,
      task.semester
    );


  const facultyNames =
    assignedFaculty
      .map(
        faculty =>
          faculty.name
      )
      .filter(
        Boolean
      );


  if (
    assignedFaculty.length ===
    0
  ) {

    return (

      `Unable to schedule "${task.subjectName}" ` +
      `for ${task.semesterKey}. ` +
      `No faculty is assigned to this subject.`

    );

  }


  if (
    task.type ===
    "lab"
  ) {

    return (

      `Unable to schedule lab "${task.subjectName}" ` +
      `for ${task.semesterKey}. ` +
      `Check available laboratories, valid lab blocks ` +
      `and faculty availability. ` +
      `Assigned faculty: ${facultyNames.join(", ")}`

    );

  }


  return (

    `Unable to schedule "${task.subjectName}" ` +
    `(${task.type}) for ${task.semesterKey}. ` +
    `Check faculty availability, classroom capacity ` +
    `and cross-semester clashes. ` +
    `Assigned faculty: ${facultyNames.join(", ")}`

  );

}


// ============================================================
// GENERATION RESULT
// ============================================================

function renderGenerationResult(
  entries,
  semesters
) {

  const element =
    document.querySelector(
      "#generationStatus"
    );


  if (!element) {
    return;
  }


  const totalEntries =
    entries.length;


  const totalLectures =
    entries.filter(
      entry =>
        entry.type ===
        "lecture"
    ).length;


  const totalTutorials =
    entries.filter(
      entry =>
        entry.type ===
        "tutorial"
    ).length;


  const totalLabs =
    entries.filter(
      entry =>
        entry.type ===
          "lab"
        ||
        entry.type ===
          "project"
        ||
        entry.type ===
          "seminar"
    ).length;


  const semesterText =
    semesters
      .map(
        semester =>
          semester.key
      )
      .join(", ");


  element.innerHTML = `

    <div class="status-summary">

      <strong>
        Timetable Generated
      </strong>


      <div style="margin-top:8px;">

        <strong>
          Semesters:
        </strong>

        ${escapeHtml(
          semesterText
        )}

      </div>


      <div>

        Scheduled teaching blocks:
        ${totalEntries}

      </div>


      <div>

        Lecture blocks:
        ${totalLectures}

      </div>


      <div>

        Tutorial blocks:
        ${totalTutorials}

      </div>


      <div>

        Lab/Project/Seminar blocks:
        ${totalLabs}

      </div>


      <div>

        Faculty clashes:
        0

      </div>


      <div>

        Classroom/Lab clashes:
        0

      </div>


      <div>

        Student/cohort clashes:
        0

      </div>


      <div>

        Cross-semester coordination:
        Enabled

      </div>

    </div>

  `;

}


// ============================================================
// CLASS KEY
// ============================================================

function getClassKey(
  semesterKey,
  day,
  period
) {

  return (

    `${semesterKey}_${day}_${period}`

  );

}


// ============================================================
// FACULTY KEY
// ============================================================

function getFacultyKey(
  facultyId,
  day,
  period
) {

  return (

    `${facultyId}_${day}_${period}`

  );

}


// ============================================================
// ROOM KEY
// ============================================================

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
// NORMALIZE YEAR
// ============================================================

function normalizeYear(
  value
) {

  return String(
    value ||
    ""
  )
    .trim()
    .toUpperCase();

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

    console.log(
      `[${type}] ${message}`
    );

    return;

  }


  element.innerHTML =
    message;


  element.className =
    `form-message ${type}`;

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
    return;
  }


  element.innerHTML =
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


  element.innerHTML =
    "";


  element.className =
    "form-message";

}


// ============================================================
// SET TEXT
// ============================================================

function setText(
  selector,
  value
) {

  const element =
    document.querySelector(
      selector
    );


  if (
    element
  ) {

    element.textContent =
      value;

  }

}


// ============================================================
// NUMBER
// ============================================================

function numberValue(
  value
) {

  const result =
    Number(
      value
    );


  return Number.isFinite(
    result
  )
    ? result
    : 0;

}


// ============================================================
// SHUFFLE
// ============================================================

function shuffle(
  array
) {

  const result =
    [
      ...array
    ];


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