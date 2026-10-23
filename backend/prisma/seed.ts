import bcrypt from "bcryptjs";
import { PrismaClient, Role, Sex } from "@prisma/client";

const prisma = new PrismaClient();

const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

async function seed(): Promise<void> {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD must be set before running the Prisma seed.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: "admin@mnhs.local" },
    update: { passwordHash, role: Role.ADMIN, firstName: "School", lastName: "Administrator" },
    create: {
      email: "admin@mnhs.local",
      passwordHash,
      role: Role.ADMIN,
      firstName: "School",
      lastName: "Administrator",
    },
  });

  const teacherDetails = [
    { employeeNo: "TCH-0001", email: "teacher1@mnhs.local", firstName: "Maria", lastName: "Santos" },
    { employeeNo: "TCH-0002", email: "teacher2@mnhs.local", firstName: "Jose", lastName: "Reyes" },
  ];
  const teachers = [];
  for (const details of teacherDetails) {
    const user = await prisma.user.upsert({
      where: { email: details.email },
      update: { role: Role.TEACHER, firstName: details.firstName, lastName: details.lastName },
      create: {
        email: details.email,
        passwordHash,
        role: Role.TEACHER,
        firstName: details.firstName,
        lastName: details.lastName,
      },
    });
    teachers.push(
      await prisma.teacher.upsert({
        where: { employeeNo: details.employeeNo },
        update: {
          userId: user.id,
          firstName: details.firstName,
          lastName: details.lastName,
        },
        create: {
          employeeNo: details.employeeNo,
          userId: user.id,
          firstName: details.firstName,
          lastName: details.lastName,
        },
      }),
    );
  }

  const schoolYear = await prisma.schoolYear.upsert({
    where: { name: "2025-2026" },
    update: {
      startDate: date("2025-06-01"),
      endDate: date("2026-03-31"),
      isCurrent: true,
    },
    create: {
      name: "2025-2026",
      startDate: date("2025-06-01"),
      endDate: date("2026-03-31"),
      isCurrent: true,
    },
  });

  const terms = [];
  const termDates = [
    ["2025-06-01", "2025-08-31"],
    ["2025-09-01", "2025-11-30"],
    ["2025-12-01", "2026-01-31"],
    ["2026-02-01", "2026-03-31"],
  ];
  for (let index = 0; index < termDates.length; index += 1) {
    const [startDate, endDate] = termDates[index];
    terms.push(
      await prisma.term.upsert({
        where: { schoolYearId_termNumber: { schoolYearId: schoolYear.id, termNumber: index + 1 } },
        update: {
          name: `Quarter ${index + 1}`,
          startDate: date(startDate),
          endDate: date(endDate),
        },
        create: {
          schoolYearId: schoolYear.id,
          name: `Quarter ${index + 1}`,
          termNumber: index + 1,
          startDate: date(startDate),
          endDate: date(endDate),
        },
      }),
    );
  }

  const subjectDetails = [
    { code: "ENG7", name: "English 7" },
    { code: "MATH7", name: "Mathematics 7" },
    { code: "SCI7", name: "Science 7" },
    { code: "FIL7", name: "Filipino 7" },
  ];
  const subjects = [];
  for (const details of subjectDetails) {
    subjects.push(
      await prisma.subject.upsert({
        where: { code: details.code },
        update: { name: details.name, gradeLevel: 7 },
        create: { ...details, gradeLevel: 7 },
      }),
    );
  }

  const section = await prisma.section.upsert({
    where: { name_gradeLevel: { name: "Rizal", gradeLevel: 7 } },
    update: {},
    create: { name: "Rizal", gradeLevel: 7 },
  });

  const studentDetails = [
    ["STU-2025-0001", "Ana", "Dela Cruz", Sex.FEMALE],
    ["STU-2025-0002", "Ben", "Garcia", Sex.MALE],
    ["STU-2025-0003", "Carla", "Mendoza", Sex.FEMALE],
    ["STU-2025-0004", "Daniel", "Ramos", Sex.MALE],
    ["STU-2025-0005", "Ella", "Torres", Sex.FEMALE],
    ["STU-2025-0006", "Felix", "Villanueva", Sex.MALE],
    ["STU-2025-0007", "Grace", "Aquino", Sex.FEMALE],
    ["STU-2025-0008", "Hugo", "Castillo", Sex.MALE],
    ["STU-2025-0009", "Iris", "Navarro", Sex.FEMALE],
    ["STU-2025-0010", "Jorge", "Flores", Sex.MALE],
  ] as const;

  const students = [];
  for (const [studentNo, firstName, lastName, sex] of studentDetails) {
    const student = await prisma.student.upsert({
      where: { studentNo },
      update: { firstName, lastName, sex, status: "ACTIVE" },
      create: { studentNo, firstName, lastName, sex },
    });
    students.push(student);
    await prisma.enrollment.upsert({
      where: { studentId_schoolYearId: { studentId: student.id, schoolYearId: schoolYear.id } },
      update: { sectionId: section.id, status: "ENROLLED" },
      create: {
        studentId: student.id,
        schoolYearId: schoolYear.id,
        sectionId: section.id,
      },
    });
  }

  for (const term of terms) {
    for (const [subjectIndex, subject] of subjects.entries()) {
      const teacher = teachers[subjectIndex % teachers.length];
      await prisma.classOffering.upsert({
        where: {
          subjectId_sectionId_termId: {
            subjectId: subject.id,
            sectionId: section.id,
            termId: term.id,
          },
        },
        update: {
          teacherId: teacher.id,
          schoolYearId: schoolYear.id,
        },
        create: {
          subjectId: subject.id,
          sectionId: section.id,
          teacherId: teacher.id,
          schoolYearId: schoolYear.id,
          termId: term.id,
        },
      });
    }
  }

  console.log(`Seeded ${students.length} students in section ${section.name}.`);
}

seed()
  .catch((error: unknown) => {
    console.error("Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
