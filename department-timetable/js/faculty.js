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


const facultyCollection =
  collection(db, "faculty");

const subjectsCollection =
  collection(db, "subjects");


let faculty = [];
let subjects = [];

let editingFacultyId = null;


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

  listenForFaculty();

  listenForSubjects();

}


// --------------------------------------------------
// EVENTS
// --------------------------------------------------

function setupEvents() {

  document
    .querySelector("#addFacultyButton")
    .addEventListener(
      "click",
      () => openFacultyModal()
    );


  document
    .querySelector("#closeFacultyModal")
    .addEventListener(
      "click",
      closeFacultyModal
    );


  document
    .querySelector("#cancelFacultyButton")
    .addEventListener(
      "click",
      closeFacultyModal
    );


  document
    .querySelector("#facultyForm")
    .addEventListener(
      "submit",
      saveFaculty
    );


  document
    .querySelector("#facultySearch")
    .addEventListener(
      "input",
      renderFaculty
    );


  document
    .querySelector("#facultyTableBody")
    .addEventListener(
      "click",
      handleTableAction
    );

}



// --------------------------------------------------
// LOAD FACULTY
// --------------------------------------------------

function listenForFaculty() {

  onSnapshot(
    facultyCollection,

    snapshot => {

      faculty =
        snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        }));

      renderFaculty();

      updateStatistics();

    },

    error => {

      console.error(
        "Faculty loading error:",
        error
      );

      document
        .querySelector("#facultyTableBody")
        .innerHTML = `
          <tr>
            <td colspan="8" class="empty-state">
              Unable to load faculty.
            </td>
          </tr>
        `;

    }
  );

}


// --------------------------------------------------
// LOAD SUBJECTS
// --------------------------------------------------

function listenForSubjects() {

  onSnapshot(
    subjectsCollection,

    snapshot => {

      subjects =
        snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        }));

      renderQualificationList();

    },

    error => {

      console.error(
        "Subject loading error:",
        error
      );

      document
        .querySelector("#qualificationList")
        .textContent =
        "Unable to load subjects.";

    }
  );

}


// --------------------------------------------------
// OPEN MODAL
// --------------------------------------------------

function openFacultyModal(member = null) {

  const modal =
    document.querySelector(
      "#facultyModal"
    );

  const form =
    document.querySelector(
      "#facultyForm"
    );


  editingFacultyId =
    member?.id || null;


  form.reset();


  document.querySelector(
    "#facultyModalTitle"
  ).textContent =
    member
      ? "Edit Faculty"
      : "Add Faculty";


  document.querySelector(
    "#facultyId"
  ).value =
    member?.id || "";


  document.querySelector(
    "#facultyName"
  ).value =
    member?.name || "";


  document.querySelector(
    "#employeeId"
  ).value =
    member?.employeeId || "";


  document.querySelector(
    "#designation"
  ).value =
    member?.designation || "";


  document.querySelector(
    "#facultyEmail"
  ).value =
    member?.email || "";


  document.querySelector(
    "#workloadLimit"
  ).value =
    member?.workloadLimit ?? 20;


  document.querySelector(
    "#facultyStatus"
  ).value =
    member?.active === false
      ? "false"
      : "true";


  const availableDays =
    member?.availableDays ||
    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday"
    ];


  document
    .querySelectorAll(".faculty-day")
    .forEach(checkbox => {

      checkbox.checked =
        availableDays.includes(
          checkbox.value
        );

    });


  renderQualificationList(
    member?.qualifiedSubjectIds || []
  );


  document.querySelector(
    "#facultyMessage"
  ).textContent = "";


  modal.removeAttribute("hidden");

  modal.style.display = "flex";

}


// --------------------------------------------------
// CLOSE MODAL
// --------------------------------------------------

function closeFacultyModal() {

  const modal =
    document.querySelector(
      "#facultyModal"
    );


  modal.setAttribute(
    "hidden",
    ""
  );

  modal.style.display =
    "none";


  editingFacultyId =
    null;


  document
    .querySelector("#facultyForm")
    .reset();


  document.querySelector(
    "#facultyMessage"
  ).textContent = "";

}


// --------------------------------------------------
// QUALIFICATION LIST
// --------------------------------------------------

function renderQualificationList(
  selectedIds = []
) {

  const container =
    document.querySelector(
      "#qualificationList"
    );


  if (subjects.length === 0) {

    container.innerHTML = `
      <p>
        No subjects found.
        Add subjects first.
      </p>
    `;

    return;
  }


  const activeSubjects =
    subjects
      .filter(
        subject =>
          subject.active !== false
      )
      .sort(
        (a, b) =>
          Number(a.semester || 0) -
          Number(b.semester || 0)
      );


  container.innerHTML =
    activeSubjects
      .map(subject => {

        const checked =
          selectedIds.includes(
            subject.id
          )
            ? "checked"
            : "";


        return `
          <label
            style="
              display:flex;
              align-items:center;
              gap:10px;
              padding:8px;
              border-bottom:1px solid #eee;
            "
          >

            <input
              type="checkbox"
              class="qualified-subject"
              value="${subject.id}"
              ${checked}
            >

            <span>

              <strong>
                ${escapeHtml(subject.name)}
              </strong>

              <small>
                — ${escapeHtml(subject.year || "")}
                / Sem ${subject.semester || ""}
              </small>

            </span>

          </label>
        `;

      })
      .join("");

}


// --------------------------------------------------
// SAVE FACULTY
// --------------------------------------------------

async function saveFaculty(event) {

  event.preventDefault();


  const button =
    document.querySelector(
      "#saveFacultyButton"
    );


  const message =
    document.querySelector(
      "#facultyMessage"
    );


  button.disabled = true;

  button.textContent =
    "Saving...";


  try {

    const name =
      document
        .querySelector("#facultyName")
        .value
        .trim();


    const employeeId =
      document
        .querySelector("#employeeId")
        .value
        .trim();


    const designation =
      document
        .querySelector("#designation")
        .value
        .trim();


    const email =
      document
        .querySelector("#facultyEmail")
        .value
        .trim();


    const workloadLimit =
      Number(
        document
          .querySelector("#workloadLimit")
          .value
      );


    const active =
      document
        .querySelector("#facultyStatus")
        .value === "true";


    const availableDays =
      Array.from(
        document.querySelectorAll(
          ".faculty-day:checked"
        )
      ).map(
        checkbox =>
          checkbox.value
      );


    const qualifiedSubjectIds =
      Array.from(
        document.querySelectorAll(
          ".qualified-subject:checked"
        )
      ).map(
        checkbox =>
          checkbox.value
      );


    if (!name) {

      throw new Error(
        "Faculty name is required."
      );

    }


    if (
      availableDays.length === 0
    ) {

      throw new Error(
        "Select at least one available day."
      );

    }


    if (
      workloadLimit < 1
    ) {

      throw new Error(
        "Enter a valid workload limit."
      );

    }


    const facultyData = {

      name,

      employeeId,

      designation,

      email,

      availableDays,

      workloadLimit,

      qualifiedSubjectIds,

      active,

      updatedAt:
        serverTimestamp()

    };


    if (editingFacultyId) {

      await updateDoc(
        doc(
          db,
          "faculty",
          editingFacultyId
        ),
        facultyData
      );


      showMessage(
        "Faculty updated successfully.",
        "success"
      );

    } else {

      facultyData.createdAt =
        serverTimestamp();


      await addDoc(
        facultyCollection,
        facultyData
      );


      showMessage(
        "Faculty added successfully.",
        "success"
      );

    }


    setTimeout(
      closeFacultyModal,
      500
    );


  } catch (error) {

    console.error(error);


    showMessage(
      error.message ||
      "Unable to save faculty.",
      "error"
    );

  } finally {

    button.disabled = false;

    button.textContent =
      "Save Faculty";

  }

}


// --------------------------------------------------
// RENDER FACULTY
// --------------------------------------------------

function renderFaculty() {

  const tbody =
    document.querySelector(
      "#facultyTableBody"
    );


  const search =
    document
      .querySelector("#facultySearch")
      .value
      .trim()
      .toLowerCase();


  const filtered =
    faculty.filter(member => {

      if (!search) {
        return true;
      }


      return (

        (member.name || "")
          .toLowerCase()
          .includes(search)

        ||

        (member.employeeId || "")
          .toLowerCase()
          .includes(search)

        ||

        (member.designation || "")
          .toLowerCase()
          .includes(search)

        ||

        (member.email || "")
          .toLowerCase()
          .includes(search)

      );

    });


  if (filtered.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No faculty found.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    filtered
      .sort(
        (a, b) =>
          (a.name || "")
            .localeCompare(
              b.name || ""
            )
      )
      .map(member => {

        const days =
          Array.isArray(
            member.availableDays
          )
            ? member.availableDays.length
            : 0;


        const qualifiedCount =
          Array.isArray(
            member.qualifiedSubjectIds
          )
            ? member.qualifiedSubjectIds.length
            : 0;


        const status =
          member.active === false
            ? "Inactive"
            : "Active";


        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(member.name || "")}
              </strong>
            </td>

            <td>
              ${escapeHtml(member.employeeId || "—")}
            </td>

            <td>
              ${escapeHtml(member.designation || "—")}
            </td>

            <td>
              ${escapeHtml(member.email || "—")}
            </td>

            <td>
              ${days} day(s)
            </td>

            <td>
              ${qualifiedCount} subject(s)
            </td>

            <td>
              ${status}
            </td>

            <td>

              <button
                type="button"
                class="outline-button"
                data-action="edit"
                data-id="${member.id}"
              >
                Edit
              </button>

              <button
                type="button"
                class="outline-button"
                data-action="delete"
                data-id="${member.id}"
              >
                Delete
              </button>

            </td>

          </tr>
        `;

      })
      .join("");

}



// --------------------------------------------------
// TABLE ACTIONS
// --------------------------------------------------

function handleTableAction(event) {

  const button =
    event.target.closest(
      "button[data-action]"
    );


  if (!button) {
    return;
  }


  const member =
    faculty.find(
      item =>
        item.id === button.dataset.id
    );


  if (!member) {
    return;
  }


  if (
    button.dataset.action === "edit"
  ) {

    openFacultyModal(member);

    return;
  }


  if (
    button.dataset.action === "delete"
  ) {

    deleteFaculty(member);

  }

}


// --------------------------------------------------
// DELETE
// --------------------------------------------------

async function deleteFaculty(member) {

  const confirmed =
    window.confirm(
      `Delete "${member.name}"?`
    );


  if (!confirmed) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "faculty",
        member.id
      )
    );

  } catch (error) {

    console.error(error);

    alert(
      "Unable to delete faculty."
    );

  }

}


// --------------------------------------------------
// STATISTICS
// --------------------------------------------------

function updateStatistics() {

  const total =
    faculty.length;


  const active =
    faculty.filter(
      member =>
        member.active !== false
    ).length;


  const inactive =
    total - active;


  const totalDays =
    faculty.reduce(
      (sum, member) =>
        sum +
        (
          Array.isArray(
            member.availableDays
          )
            ? member.availableDays.length
            : 0
        ),
      0
    );


  document.querySelector(
    "#totalFaculty"
  ).textContent =
    total;


  document.querySelector(
    "#activeFaculty"
  ).textContent =
    active;


  document.querySelector(
    "#inactiveFaculty"
  ).textContent =
    inactive;


  document.querySelector(
    "#facultyDays"
  ).textContent =
    totalDays;

}


// --------------------------------------------------
// HELPERS
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


function showMessage(
  message,
  type
) {

  const element =
    document.querySelector(
      "#facultyMessage"
    );


  element.textContent =
    message;


  element.className =
    `form-message ${type}`;

}


// --------------------------------------------------
// START
// --------------------------------------------------

initialisePage()
  .catch(error => {

    if (
      error.message !==
      "Firebase has not been configured."
    ) {

      console.error(error);

    }

  });