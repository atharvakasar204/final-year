// ============================================================
// TIMELY - SUBJECT MANAGEMENT
// subjects.js
// Firebase 12.1.0
//
// IMPORTANT:
// - NO default/built-in subjects
// - NO automatic subject seeding
// - All subjects are added manually by the user
// - Delete is permanent from Firestore
// ============================================================

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  requireAuthenticatedUser,
  enableSignOut
} from "./auth-guard.js";

import { renderNavigation } from "./layout.js";


// ============================================================
// FIRESTORE
// ============================================================

const subjectsCollection = collection(db, "subjects");

let subjects = [];
let editingSubjectId = null;


// ============================================================
// INITIALISE PAGE
// ============================================================

async function initialisePage() {

  renderNavigation();

  await requireAuthenticatedUser();

  const protectedContent =
    document.querySelector("#protectedContent");

  if (protectedContent) {
    protectedContent.removeAttribute("hidden");
  }

  enableSignOut();

  setupEvents();

  // IMPORTANT:
  // There is NO seedBuiltInSubjects() here.
  // Subjects are loaded only from Firestore.
  listenForSubjects();

}


// ============================================================
// EVENTS
// ============================================================

function setupEvents() {

  // Add Subject
  document
    .querySelector("#addSubjectButton")
    ?.addEventListener(
      "click",
      () => openModal()
    );


  // Close modal
  document
    .querySelector("#closeModalButton")
    ?.addEventListener(
      "click",
      closeModal
    );


  // Cancel
  document
    .querySelector("#cancelButton")
    ?.addEventListener(
      "click",
      closeModal
    );


  // Form submit
  document
    .querySelector("#subjectForm")
    ?.addEventListener(
      "submit",
      saveSubject
    );


  // Filters
  document
    .querySelector("#yearFilter")
    ?.addEventListener(
      "change",
      renderSubjects
    );


  document
    .querySelector("#semesterFilter")
    ?.addEventListener(
      "change",
      renderSubjects
    );


  document
    .querySelector("#typeFilter")
    ?.addEventListener(
      "change",
      renderSubjects
    );


  // Table actions
  document
    .querySelector("#subjectsTableBody")
    ?.addEventListener(
      "click",
      handleTableAction
    );

}


// ============================================================
// LOAD SUBJECTS FROM FIRESTORE
// ============================================================

function listenForSubjects() {

  const tbody =
    document.querySelector(
      "#subjectsTableBody"
    );


  if (tbody) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="11"
          class="empty-state"
        >
          Loading subjects...
        </td>
      </tr>
    `;

  }


  onSnapshot(

    subjectsCollection,

    snapshot => {

      subjects =
        snapshot.docs.map(
          item => ({
            id: item.id,
            ...item.data()
          })
        );


      renderSubjects();

      updateStatistics();

    },

    error => {

      console.error(
        "Error loading subjects:",
        error
      );


      if (tbody) {

        tbody.innerHTML = `
          <tr>
            <td
              colspan="11"
              class="empty-state"
            >
              Unable to load subjects.
            </td>
          </tr>
        `;

      }

    }

  );

}


// ============================================================
// OPEN MODAL
// ============================================================

function openModal(subject = null) {

  const modal =
    document.querySelector(
      "#subjectModal"
    );


  if (!modal) {
    return;
  }


  const form =
    document.querySelector(
      "#subjectForm"
    );


  editingSubjectId =
    subject?.id || null;


  form?.reset();


  const modalTitle =
    document.querySelector(
      "#modalTitle"
    );


  if (modalTitle) {

    modalTitle.textContent =
      subject
        ? "Edit Subject"
        : "Add Subject";

  }


  const subjectId =
    document.querySelector(
      "#subjectId"
    );


  if (subjectId) {

    subjectId.value =
      subject?.id || "";

  }


  const subjectName =
    document.querySelector(
      "#subjectName"
    );


  if (subjectName) {

    subjectName.value =
      subject?.name || "";

  }


  const subjectCode =
    document.querySelector(
      "#subjectCode"
    );


  if (subjectCode) {

    subjectCode.value =
      subject?.code || "";

  }


  const year =
    document.querySelector(
      "#year"
    );


  if (year) {

    year.value =
      subject?.year || "";

  }


  const semester =
    document.querySelector(
      "#semester"
    );


  if (semester) {

    semester.value =
      subject?.semester || "";

  }


  const lectureHours =
    document.querySelector(
      "#lectureHours"
    );


  if (lectureHours) {

    lectureHours.value =
      subject?.lectureHours ?? 0;

  }


  const tutorialHours =
    document.querySelector(
      "#tutorialHours"
    );


  if (tutorialHours) {

    tutorialHours.value =
      subject?.tutorialHours ?? 0;

  }


  const practicalHours =
    document.querySelector(
      "#practicalHours"
    );


  if (practicalHours) {

    practicalHours.value =
      subject?.practicalHours ?? 0;

  }


  const subjectType =
    document.querySelector(
      "#subjectType"
    );


  if (subjectType) {

    subjectType.value =
      subject?.type || "theory";

  }


  const electiveGroup =
    document.querySelector(
      "#electiveGroup"
    );


  if (electiveGroup) {

    electiveGroup.value =
      subject?.electiveGroup || "";

  }


  const active =
    document.querySelector(
      "#active"
    );


  if (active) {

    active.value =
      subject?.active === false
        ? "false"
        : "true";

  }


  const message =
    document.querySelector(
      "#subjectMessage"
    );


  if (message) {

    message.textContent = "";

    message.className =
      "form-message";

  }


  modal.removeAttribute(
    "hidden"
  );


  modal.style.display =
    "flex";

}


// ============================================================
// CLOSE MODAL
// ============================================================

function closeModal() {

  const modal =
    document.querySelector(
      "#subjectModal"
    );


  if (!modal) {
    return;
  }


  modal.setAttribute(
    "hidden",
    ""
  );


  modal.style.display =
    "none";


  editingSubjectId =
    null;


  document
    .querySelector("#subjectForm")
    ?.reset();


  const message =
    document.querySelector(
      "#subjectMessage"
    );


  if (message) {

    message.textContent = "";

    message.className =
      "form-message";

  }

}


// ============================================================
// SAVE SUBJECT
// ============================================================

async function saveSubject(event) {

  event.preventDefault();


  const button =
    document.querySelector(
      "#saveSubjectButton"
    );


  const message =
    document.querySelector(
      "#subjectMessage"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "Saving...";

  }


  try {

    const name =
      document
        .querySelector("#subjectName")
        ?.value
        .trim() || "";


    const code =
      document
        .querySelector("#subjectCode")
        ?.value
        .trim() || "";


    const year =
      document
        .querySelector("#year")
        ?.value || "";


    const semester =
      Number(
        document
          .querySelector("#semester")
          ?.value
      );


    const lectureHours =
      Number(
        document
          .querySelector("#lectureHours")
          ?.value
      );


    const tutorialHours =
      Number(
        document
          .querySelector("#tutorialHours")
          ?.value
      );


    const practicalHours =
      Number(
        document
          .querySelector("#practicalHours")
          ?.value
      );


    const type =
      document
        .querySelector("#subjectType")
        ?.value || "theory";


    const electiveGroup =
      document
        .querySelector("#electiveGroup")
        ?.value || "";


    const active =
      document
        .querySelector("#active")
        ?.value === "true";


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!name) {

      throw new Error(
        "Subject name is required."
      );

    }


    if (!year) {

      throw new Error(
        "Please select a year."
      );

    }


    if (!semester) {

      throw new Error(
        "Please select a semester."
      );

    }


    if (
      lectureHours < 0 ||
      tutorialHours < 0 ||
      practicalHours < 0
    ) {

      throw new Error(
        "L/T/P hours cannot be negative."
      );

    }


    if (
      lectureHours === 0 &&
      tutorialHours === 0 &&
      practicalHours === 0
    ) {

      throw new Error(
        "At least one L/T/P hour is required."
      );

    }


    // ========================================================
    // SUBJECT DATA
    // ========================================================

    const subjectData = {

      name,

      code,

      year,

      semester,

      lectureHours,

      tutorialHours,

      practicalHours,

      weeklyHours:
        lectureHours +
        tutorialHours +
        practicalHours,

      type,

      electiveGroup:
        electiveGroup || null,

      active,

      source:
        "manual",

      updatedAt:
        serverTimestamp()

    };


    // ========================================================
    // UPDATE EXISTING SUBJECT
    // ========================================================

    if (editingSubjectId) {

      await updateDoc(

        doc(
          db,
          "subjects",
          editingSubjectId
        ),

        subjectData

      );


      showMessage(
        "Subject updated successfully.",
        "success"
      );

    }


    // ========================================================
    // ADD NEW SUBJECT
    // ========================================================

    else {

      subjectData.createdAt =
        serverTimestamp();


      await addDoc(
        subjectsCollection,
        subjectData
      );


      showMessage(
        "Subject added successfully.",
        "success"
      );

    }


    // Close after successful save
    setTimeout(
      closeModal,
      500
    );


  } catch (error) {

    console.error(
      "Subject save error:",
      error
    );


    showMessage(
      error.message ||
      "Unable to save subject.",
      "error"
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "Save Subject";

    }

  }

}


// ============================================================
// RENDER SUBJECTS
// ============================================================

function renderSubjects() {

  const tbody =
    document.querySelector(
      "#subjectsTableBody"
    );


  if (!tbody) {
    return;
  }


  const year =
    document.querySelector(
      "#yearFilter"
    )?.value || "all";


  const semester =
    document.querySelector(
      "#semesterFilter"
    )?.value || "all";


  const type =
    document.querySelector(
      "#typeFilter"
    )?.value || "all";


  const filtered =
    subjects.filter(
      subject => {

        if (
          year !== "all" &&
          subject.year !== year
        ) {

          return false;

        }


        if (
          semester !== "all" &&
          String(subject.semester) !== semester
        ) {

          return false;

        }


        if (
          type !== "all" &&
          subject.type !== type
        ) {

          return false;

        }


        return true;

      }
    );


  if (filtered.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="11"
          class="empty-state"
        >
          No subjects found.
        </td>
      </tr>
    `;

    return;

  }


  filtered.sort(
    (a, b) => {

      const semesterDifference =
        Number(a.semester || 0) -
        Number(b.semester || 0);


      if (
        semesterDifference !== 0
      ) {

        return semesterDifference;

      }


      return (
        a.name || ""
      ).localeCompare(
        b.name || ""
      );

    }
  );


  tbody.innerHTML =
    filtered
      .map(
        subject => {

          const elective =
            subject.electiveGroup ||
            "—";


          const status =
            subject.active === false
              ? "Inactive"
              : "Active";


          return `
            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    subject.name || ""
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  subject.code || "—"
                )}
              </td>

              <td>
                ${escapeHtml(
                  subject.year || "—"
                )}
              </td>

              <td>
                ${subject.semester || "—"}
              </td>

              <td>
                ${subject.lectureHours ?? 0}
              </td>

              <td>
                ${subject.tutorialHours ?? 0}
              </td>

              <td>
                ${subject.practicalHours ?? 0}
              </td>

              <td>
                ${formatType(
                  subject.type
                )}
              </td>

              <td>
                ${escapeHtml(
                  elective
                )}
              </td>

              <td>
                ${status}
              </td>

              <td>

                <button
                  type="button"
                  class="outline-button"
                  data-action="edit"
                  data-id="${escapeHtml(subject.id)}"
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="outline-button"
                  data-action="delete"
                  data-id="${escapeHtml(subject.id)}"
                >
                  Delete
                </button>

              </td>

            </tr>
          `;

        }
      )
      .join("");

}


// ============================================================
// TABLE ACTIONS
// ============================================================

function handleTableAction(event) {

  const button =
    event.target.closest(
      "button[data-action]"
    );


  if (!button) {
    return;
  }


  const subjectId =
    button.dataset.id;


  const subject =
    subjects.find(
      item =>
        item.id === subjectId
    );


  if (!subject) {

    console.error(
      "Subject not found:",
      subjectId
    );

    return;

  }


  const action =
    button.dataset.action;


  if (action === "edit") {

    openModal(subject);

    return;

  }


  if (action === "delete") {

    deleteSubject(subject);

  }

}


// ============================================================
// DELETE SUBJECT
// ============================================================

async function deleteSubject(subject) {

  const confirmed =
    window.confirm(
      `Delete "${subject.name}" permanently?`
    );


  if (!confirmed) {
    return;
  }


  try {

    // Delete directly from Firestore.
    await deleteDoc(
      doc(
        db,
        "subjects",
        subject.id
      )
    );


    // Remove immediately from local array.
    subjects =
      subjects.filter(
        item =>
          item.id !== subject.id
      );


    // Update UI immediately.
    renderSubjects();

    updateStatistics();


    console.log(
      `Subject deleted permanently: ${subject.name}`
    );


  } catch (error) {

    console.error(
      "Delete subject error:",
      error
    );


    alert(
      error.message ||
      "Unable to delete subject."
    );

  }

}


// ============================================================
// STATISTICS
// ============================================================

function updateStatistics() {

  const total =
    subjects.length;


  const theory =
    subjects.filter(
      subject =>
        subject.type === "theory"
    ).length;


  const labs =
    subjects.filter(
      subject =>
        subject.type === "lab"
    ).length;


  const electives =
    subjects.filter(
      subject =>
        Boolean(
          subject.electiveGroup
        )
    ).length;


  const totalElement =
    document.querySelector(
      "#totalSubjects"
    );


  const theoryElement =
    document.querySelector(
      "#theorySubjects"
    );


  const labElement =
    document.querySelector(
      "#labSubjects"
    );


  const electiveElement =
    document.querySelector(
      "#electiveSubjects"
    );


  if (totalElement) {

    totalElement.textContent =
      total;

  }


  if (theoryElement) {

    theoryElement.textContent =
      theory;

  }


  if (labElement) {

    labElement.textContent =
      labs;

  }


  if (electiveElement) {

    electiveElement.textContent =
      electives;

  }

}


// ============================================================
// FORMAT TYPE
// ============================================================

function formatType(type) {

  const names = {

    theory: "Theory",

    lab: "Lab",

    seminar: "Seminar",

    project: "Project",

    audit: "Audit"

  };


  return (
    names[type] ||
    "—"
  );

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(
  message,
  type
) {

  const element =
    document.querySelector(
      "#subjectMessage"
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


// ============================================================
// START APPLICATION
// ============================================================

initialisePage()
  .catch(
    error => {

      if (
        error.message !==
        "Firebase has not been configured."
      ) {

        console.error(
          "Subjects page error:",
          error
        );

      }

    }
  );