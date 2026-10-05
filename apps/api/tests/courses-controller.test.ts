/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFilters,
  argOf,
  createSupabaseMock,
  filterOf,
  makeRes,
  type TableHandler,
} from "./helpers/mocks";

// The controller reads the supabaseAdmin singleton directly (and through
// lib/staff-actor.ts) — route it to a per-test mock.
const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const COURSE_ID = "99999999-1111-4222-8333-444444444444";
const LESSON_ID = "11111111-1111-4222-8333-444444444444";
const DOCTOR_ID = "88888888-1111-4222-8333-444444444444";
const DOCTOR_USER_ID = "77777777-1111-4222-8333-444444444444";
const OTHER_DOCTOR_ID = "33333333-1111-4222-8333-444444444444";
const OTHER_DOCTOR_USER_ID = "22222222-1111-4222-8333-444444444444";
const PARENT_USER_ID = "66666666-1111-4222-8333-444444444444";
const ADMIN_USER_ID = "44444444-1111-4222-8333-444444444444";

const DOCTORS = [
  { id: DOCTOR_ID, profile_id: DOCTOR_USER_ID },
  { id: OTHER_DOCTOR_ID, profile_id: OTHER_DOCTOR_USER_ID },
];
const PROFILES = [
  { id: DOCTOR_USER_ID, role: "doctor" },
  { id: OTHER_DOCTOR_USER_ID, role: "doctor" },
  { id: PARENT_USER_ID, role: "parent" },
  { id: ADMIN_USER_ID, role: "admin" },
];

function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COURSE_ID,
    title: "Sleep basics",
    doctor_id: DOCTOR_ID,
    instructor_profile_id: null,
    is_published: true,
    ...overrides,
  };
}

/**
 * Stands in for courses: honours id and doctor_id filters (via .eq or
 * .match), echoes inserts and updates, and — like PostgREST's .single() —
 * errors when an update matches no row.
 */
function coursesHandler(row: Record<string, unknown>): TableHandler {
  return (q) => {
    if (q.op === "insert") {
      return { data: { id: "new-course", ...(q.payload as object) } };
    }
    const idFilter = argOf(q, "eq", "id");
    const doctorFilter = filterOf(q, "doctor_id");
    const matches =
      (idFilter === undefined || idFilter === row.id) &&
      (doctorFilter === undefined || doctorFilter === row.doctor_id);
    if (!matches) {
      return q.op === "update"
        ? { error: { message: "JSON object requested, multiple (or no) rows returned" } }
        : { data: null };
    }
    if (q.op === "update") return { data: { ...row, ...(q.payload as object) } };
    return { data: row };
  };
}

function lessonsHandler(): TableHandler {
  const lesson = { id: LESSON_ID, course_id: COURSE_ID, video_path: "courses/x.mp4", is_preview: false };
  return (q) => {
    if (q.op === "insert") return { data: { id: "new-lesson", ...(q.payload as object) } };
    if (q.op === "update") return { data: { ...lesson, ...(q.payload as object) } };
    if (q.op === "delete") return {};
    return applyFilters([lesson], q);
  };
}

function setup(opts: { course?: Record<string, unknown>; enrollments?: any[] } = {}) {
  const mock = createSupabaseMock({
    courses: coursesHandler(opts.course ?? courseRow()),
    course_lessons: lessonsHandler(),
    course_enrollments: (q) => applyFilters(opts.enrollments ?? [], q),
    doctors: (q) => applyFilters(DOCTORS, q),
    profiles: (q) => applyFilters(PROFILES, q),
  });
  (mock.client as any).storage = {
    from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/video" }, error: null }),
    }),
  };
  supabaseHolder.current = mock.client;
  return mock;
}

async function loadController() {
  return import("../src/controllers/courses");
}

beforeEach(() => {
  vi.resetModules();
  supabaseHolder.current = null;
});

describe("createCourse", () => {
  it("lets an admin with no doctor record create a course they teach", async () => {
    const mock = setup();
    const { createCourse } = await loadController();
    const res = makeRes();
    await createCourse({ body: { title: "Weaning" }, userId: ADMIN_USER_ID } as any, res as any);

    expect(res.statusCode).toBe(201);
    const insert = mock.queries.find((q) => q.table === "courses" && q.op === "insert");
    expect(insert?.payload).toMatchObject({ doctor_id: null, instructor_profile_id: ADMIN_USER_ID });
  });

  it("still makes a doctor the instructor through their doctor record", async () => {
    const mock = setup();
    const { createCourse } = await loadController();
    const res = makeRes();
    await createCourse({ body: { title: "Weaning" }, userId: DOCTOR_USER_ID } as any, res as any);

    expect(res.statusCode).toBe(201);
    const insert = mock.queries.find((q) => q.table === "courses" && q.op === "insert");
    expect(insert?.payload).toMatchObject({ doctor_id: DOCTOR_ID, instructor_profile_id: null });
  });

  it("refuses to let a parent create a course", async () => {
    const mock = setup();
    const { createCourse } = await loadController();
    const res = makeRes();
    await createCourse({ body: { title: "Weaning" }, userId: PARENT_USER_ID } as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(mock.queries.some((q) => q.op === "insert")).toBe(false);
  });
});

describe("managing another doctor's course", () => {
  it("lets an admin edit the course and its lessons", async () => {
    setup();
    const { updateCourse, addLesson, updateLesson, deleteLesson } = await loadController();

    const updated = makeRes();
    await updateCourse(
      { params: { id: COURSE_ID }, body: { title: "Renamed" }, userId: ADMIN_USER_ID } as any,
      updated as any
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.body.course.title).toBe("Renamed");

    const added = makeRes();
    await addLesson(
      { params: { id: COURSE_ID }, body: { title: "Intro", order_index: 0 }, userId: ADMIN_USER_ID } as any,
      added as any
    );
    expect(added.statusCode).toBe(201);

    const edited = makeRes();
    await updateLesson(
      { params: { id: COURSE_ID, lessonId: LESSON_ID }, body: { title: "Intro 2" }, userId: ADMIN_USER_ID } as any,
      edited as any
    );
    expect(edited.statusCode).toBe(200);

    const removed = makeRes();
    await deleteLesson(
      { params: { id: COURSE_ID, lessonId: LESSON_ID }, userId: ADMIN_USER_ID } as any,
      removed as any
    );
    expect(removed.statusCode).toBe(200);
  });

  it("still keeps one doctor out of another doctor's course", async () => {
    setup();
    const { updateCourse, addLesson } = await loadController();

    const updated = makeRes();
    await updateCourse(
      { params: { id: COURSE_ID }, body: { title: "Renamed" }, userId: OTHER_DOCTOR_USER_ID } as any,
      updated as any
    );
    expect(updated.statusCode).toBe(404);

    const added = makeRes();
    await addLesson(
      { params: { id: COURSE_ID }, body: { title: "Intro" }, userId: OTHER_DOCTOR_USER_ID } as any,
      added as any
    );
    expect(added.statusCode).toBe(404);
  });
});

describe("streamLesson", () => {
  const req = (userId: string) =>
    ({ params: { id: COURSE_ID, lessonId: LESSON_ID }, userId }) as any;

  it("lets an admin watch a non-preview lesson without enrolling", async () => {
    setup();
    const { streamLesson } = await loadController();
    const res = makeRes();
    await streamLesson(req(ADMIN_USER_ID), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.signedUrl).toBe("https://signed.example/video");
  });

  it("lets the course's own doctor watch without enrolling", async () => {
    setup();
    const { streamLesson } = await loadController();
    const res = makeRes();
    await streamLesson(req(DOCTOR_USER_ID), res as any);

    expect(res.statusCode).toBe(200);
  });

  it("lets the admin instructor of a course watch it", async () => {
    setup({ course: courseRow({ doctor_id: null, instructor_profile_id: ADMIN_USER_ID }) });
    const { streamLesson } = await loadController();
    const res = makeRes();
    await streamLesson(req(ADMIN_USER_ID), res as any);

    expect(res.statusCode).toBe(200);
  });

  it("still requires a parent to enroll", async () => {
    setup();
    const { streamLesson } = await loadController();
    const res = makeRes();
    await streamLesson(req(PARENT_USER_ID), res as any);

    expect(res.statusCode).toBe(403);
  });

  it("still keeps another doctor out of a course they do not teach", async () => {
    setup();
    const { streamLesson } = await loadController();
    const res = makeRes();
    await streamLesson(req(OTHER_DOCTOR_USER_ID), res as any);

    expect(res.statusCode).toBe(403);
  });
});
