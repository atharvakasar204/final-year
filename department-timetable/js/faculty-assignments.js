import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
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


const facultyCollection =
  collection(db, "faculty");

const subjectsCollection =
  collection(db, "subjects");

const assignmentsCollection =
  collection(db, "facultyAssignments");


let faculty = [];
let subjects = [];
let assignments = {};

let selectedFacultyId = "";


// ============================================================
// INITIALISE
// ============================================================

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  document
    .querySelector("#protectedContent")
    .removeAttribute("hidden");

  enableSignOut();

  setupEvents();

  await loadFaculty();

  await loadSubjects();

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  document
    .querySelector("#facultySelect")
    .addEventListener(
      "change",
      handleFacultyChange
    );


  document
    .querySelector("#yearFilter")
    .addEventListener(
      "change",
      renderAssignmentList
    );


  document
    .querySelector("#semesterFilter")
    .addEventListener(
      "change",
      renderAssignmentList
    );


  document
    .querySelector("#selectAllButton")
    .addEventListener(
      "click",
      selectAllQualified
    );


  document
    .querySelector("#clearAllButton")
    .addEventListener(
      "click",
      clearAllSubjects
    );


  document
    .querySelector("#saveAssignmentsButton")
    .addEventListener(
      "click",
      saveAssignments
    );

}


// ============================================================
// LOAD FACULTY
// ============================================================

async function loadFaculty() {

  try {

    const snapshot =
      await getDocs(
        facultyCollection
      );


    faculty =
      snapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(
          member =>
            member.active !== false
        )
        .sort(
          (a, b) =>
            (a.name || "")
              .localeCompare(
                b.name || ""
              )
        );


    const select =
      document.querySelector(
        "#facultySelect"
      );


    select.innerHTML = `
      <option value="">
        Select faculty member
      </option>
    `;


    faculty.forEach(member => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        member.id;

      option.textContent =
        member.name;

      select.appendChild(
        option
      );

    });


  } catch (error) {

    console.error(
      "Faculty loading error:",
      error
    );

    showMessage(
      error.message ||
      "Unable to load faculty.",
      "error"
    );

  }

}


// ============================================================
// LOAD SUBJECTS
// ============================================================

async function loadSubjects() {

  try {

    const snapshot =
      await getDocs(
        subjectsCollection
      );


    subjects =
      snapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(
          subject =>
            subject.active !== false
        );


    subjects.sort(
      (a, b) => {

        const semesterA =
          Number(
            a.semester || 0
          );

        const semesterB =
          Number(
            b.semester || 0
          );


        if (
          semesterA !==
          semesterB
        ) {

          return (
            semesterA -
            semesterB
          );

        }


        return (
          (a.name || "")
            .localeCompare(
              b.name || ""
            )
        );

      }
    );


  } catch (error) {

    console.error(
      "Subjects loading error:",
      error
    );

    showMessage(
      error.message ||
      "Unable to load subjects.",
      "error"
    );

  }

}


// ============================================================
// FACULTY CHANGE
// ============================================================

async function handleFacultyChange() {

  const select =
    document.querySelector(
      "#facultySelect"
    );


  selectedFacultyId =
    select.value;


  const section =
    document.querySelector(
      "#assignmentSection"
    );


  if (!selectedFacultyId) {

    section.hidden = true;

    return;

  }


  const member =
    faculty.find(
      item =>
        item.id ===
        selectedFacultyId
    );


  if (!member) {
    return;
  }


  section.hidden = false;


  document.querySelector(
    "#selectedFacultyName"
  ).textContent =
    member.name;


  const qualifiedCount =
    Array.isArray(
      member.qualifiedSubjectIds
    )
      ? member.qualifiedSubjectIds.length
      : 0;


  document.querySelector(
    "#facultyQualificationInfo"
  ).textContent =
    `${qualifiedCount} qualified subject(s). ` +
    `Only qualified subjects can be assigned.`;


  await loadAssignments();


  renderAssignmentList();

}


// ============================================================
// LOAD SAVED ASSIGNMENTS
// ============================================================

async function loadAssignments() {

  assignments = {};


  try {

    const assignmentRef =
      doc(
        db,
        "facultyAssignments",
        selectedFacultyId
      );


    const snapshot =
      await getDoc(
        assignmentRef
      );


    if (
      snapshot.exists()
    ) {

      const data =
        snapshot.data();


      if (
        Array.isArray(
          data.subjectIds
        )
      ) {

        data.subjectIds.forEach(
          subjectId => {

            assignments[
              subjectId
            ] = true;

          }
        );

      }

    }

  } catch (error) {

    console.error(
      "Assignment loading error:",
      error
    );

    showMessage(
      error.message ||
      "Unable to load assignments.",
      "error"
    );

  }

}


// ============================================================
// RENDER SUBJECTS
// ============================================================

function renderAssignmentList() {

  const container =
    document.querySelector(
      "#assignmentList"
    );


  if (!selectedFacultyId) {

    container.innerHTML =
      "Select a faculty member first.";

    return;

  }


  const member =
    faculty.find(
      item =>
        item.id ===
        selectedFacultyId
    );


  if (!member) {
    return;
  }


  const qualifiedIds =
    Array.isArray(
      member.qualifiedSubjectIds
    )
      ? member.qualifiedSubjectIds
      : [];


  const yearFilter =
    document.querySelector(
      "#yearFilter"
    ).value;


  const semesterFilter =
    document.querySelector(
      "#semesterFilter"
    ).value;


  const filtered =
    subjects.filter(
      subject => {

        const yearMatch =
          yearFilter === "all" ||
          String(
            subject.year || ""
          ).toUpperCase() ===
            yearFilter.toUpperCase();


        const semesterMatch =
          semesterFilter === "all" ||
          String(
            subject.semester || ""
          ) ===
            semesterFilter;


        return (
          yearMatch &&
          semesterMatch
        );

      }
    );


  if (filtered.length === 0) {

    container.innerHTML = `
      <div style="
        padding:24px;
        text-align:center;
        color:#64748b;
      ">
        No subjects found.
      </div>
    `;

    return;

  }


  const groups = {};


  filtered.forEach(
    subject => {

      const semester =
        subject.semester ||
        "Other";


      if (!groups[semester]) {
        groups[semester] = [];
      }


      groups[semester].push(
        subject
      );

    }
  );


  let html = "";


  Object.keys(groups)
    .sort(
      (a, b) =>
        Number(a) -
        Number(b)
    )
    .forEach(
      semester => {

        html += `
          <div>

            <div style="
              padding:12px 16px;
              background:#f8fafc;
              border-bottom:1px solid #e5e7eb;
              font-weight:700;
            ">
              Semester
              ${escapeHtml(
                semester
              )}
            </div>
        `;


        groups[semester].forEach(
          subject => {

            const qualified =
              qualifiedIds.includes(
                subject.id
              );


            const checked =
              assignments[
                subject.id
              ] === true;


            const periods =
              Number(
                subject.lectureHours || 0
              ) +
              Number(
                subject.tutorialHours || 0
              ) +
              Number(
                subject.practicalHours || 0
              );


            html += `
              <label style="
                display:flex;
                align-items:flex-start;
                gap:12px;
                padding:13px 16px;
                border-bottom:1px solid #f1f5f9;
                ${
                  qualified
                    ? "cursor:pointer;"
                    : "cursor:not-allowed;opacity:.55;"
                }
              ">

                <input
                  type="checkbox"
                  class="assignment-checkbox"
                  data-subject-id="${escapeHtml(
                    subject.id
                  )}"
                  ${
                    checked
                      ? "checked"
                      : ""
                  }
                  ${
                    qualified
                      ? ""
                      : "disabled"
                  }
                  style="margin-top:4px;"
                >

                <span style="flex:1;">

                  <strong>
                    ${escapeHtml(
                      subject.name ||
                      "Unnamed Subject"
                    )}
                  </strong>

                  <small style="
                    display:block;
                    color:#64748b;
                    margin-top:4px;
                  ">

                    ${escapeHtml(
                      subject.year ||
                      ""
                    )}

                    • Semester
                    ${escapeHtml(
                      subject.semester ||
                      ""
                    )}

                    • L${Number(
                      subject.lectureHours ||
                      0
                    )}

                    T${Number(
                      subject.tutorialHours ||
                      0
                    )}

                    P${Number(
                      subject.practicalHours ||
                      0
                    )}

                    • ${periods}
                    periods/week

                  </small>

                  ${
                    qualified
                      ? `
                        <small style="
                          display:block;
                          color:#166534;
                          margin-top:3px;
                        ">
                          Qualified
                        ${
                          checked
                            ? " • Assigned"
                            : ""
                        }
                        </small>
                      `
                      : `
                        <small style="
                          display:block;
                          color:#b91c1c;
                          margin-top:3px;
                        ">
                          Not qualified
                        </small>
                      `
                  }

                </span>

              </label>
            `;

          }
        );


        html += `
          </div>
        `;

      }
    );


  container.innerHTML =
    html;

}


// ============================================================
// SELECT ALL QUALIFIED
// ============================================================

function selectAllQualified() {

  if (!selectedFacultyId) {
    return;
  }


  const member =
    faculty.find(
      item =>
        item.id ===
        selectedFacultyId
    );


  if (!member) {
    return;
  }


  const qualifiedIds =
    Array.isArray(
      member.qualifiedSubjectIds
    )
      ? member.qualifiedSubjectIds
      : [];


  document
    .querySelectorAll(
      ".assignment-checkbox:not(:disabled)"
    )
    .forEach(
      checkbox => {

        checkbox.checked =
          qualifiedIds.includes(
            checkbox.dataset.subjectId
          );

      }
    );

}


// ============================================================
// CLEAR
// ============================================================

function clearAllSubjects() {

  document
    .querySelectorAll(
      ".assignment-checkbox"
    )
    .forEach(
      checkbox => {

        checkbox.checked =
          false;

      }
    );

}


// ============================================================
// SAVE
// ============================================================

async function saveAssignments() {

  if (!selectedFacultyId) {

    showMessage(
      "Select a faculty member first.",
      "error"
    );

    return;

  }


  const member =
    faculty.find(
      item =>
        item.id ===
        selectedFacultyId
    );


  if (!member) {
    return;
  }


  const qualifiedIds =
    Array.isArray(
      member.qualifiedSubjectIds
    )
      ? member.qualifiedSubjectIds
      : [];


  const selectedIds =
    Array.from(
      document.querySelectorAll(
        ".assignment-checkbox:checked"
      )
    )
      .map(
        checkbox =>
          checkbox.dataset.subjectId
      )
      .filter(
        subjectId =>
          qualifiedIds.includes(
            subjectId
          )
      );


  const selectedAssignments =
    selectedIds.map(
      subjectId => {

        const subject =
          subjects.find(
            item =>
              item.id ===
              subjectId
          );


        return {

          subjectId,

          subjectName:
            subject?.name || "",

          year:
            subject?.year || "",

          semester:
            subject?.semester || ""

        };

      }
    );


  const button =
    document.querySelector(
      "#saveAssignmentsButton"
    );


  button.disabled = true;

  button.textContent =
    "Saving...";


  try {

    await setDoc(

      doc(
        db,
        "facultyAssignments",
        selectedFacultyId
      ),

      {

        facultyId:
          selectedFacultyId,

        facultyName:
          member.name,

        subjectIds:
          selectedIds,

        assignments:
          selectedAssignments,

        updatedAt:
          serverTimestamp(),

        createdAt:
          serverTimestamp()

      },

      {
        merge: true
      }

    );


    assignments = {};

    selectedIds.forEach(
      subjectId => {

        assignments[
          subjectId
        ] = true;

      }
    );


    showMessage(
      `${selectedIds.length} subject(s) assigned successfully.`,
      "success"
    );


    renderAssignmentList();


  } catch (error) {

    console.error(
      "Save assignment error:",
      error
    );

    showMessage(
      error.message ||
      "Unable to save assignments.",
      "error"
    );

  } finally {

    button.disabled = false;

    button.textContent =
      "Save Assignments";

  }

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
  text,
  type
) {

  const element =
    document.querySelector(
      "#assignmentMessage"
    );


  element.textContent =
    text;


  element.className =
    `form-message ${type}`;

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(value ?? "")

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

initialisePage()
  .catch(error => {

    console.error(
      "Subject assignment page error:",
      error
    );

  });