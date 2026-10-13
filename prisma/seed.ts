import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const resources = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Conference Room A",
    type: "room",
    location: "Floor 2",
    capacity: 12,
    description: "Large room with projector and whiteboard.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Meeting Room B",
    type: "room",
    location: "Floor 2",
    capacity: 6,
    description: "Small meeting room.",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Projector Kit",
    type: "equipment",
    location: "IT Store",
    capacity: null,
    description: "Portable projector with HDMI cable.",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Company Van",
    type: "vehicle",
    location: "Parking Bay 3",
    capacity: 8,
    description: "8-seat van for team trips.",
  },
];

async function main() {
  // Seed resources.
  for (const r of resources) {
    await db.resource.upsert({
      where: { id: r.id },
      update: {},
      create: r,
    });
  }

  // Generate dates relative to the current UTC date.
  const day = (offset: number, hour: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };

  // Seed reservations.
  const reservations = [
    {
      id: "20000000-0000-4000-8000-000000000001",
      resourceId: resources[0].id,
      reservedByName: "Nimal Perera",
      reservedByEmail: "nimal@example.com",
      purpose: "Sprint planning",
      startAt: day(1, 4),
      endAt: day(1, 6),
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      resourceId: resources[1].id,
      reservedByName: "Sara Fernando",
      reservedByEmail: "sara@example.com",
      purpose: "Client call",
      startAt: day(1, 8),
      endAt: day(1, 9),
    },
    {
      id: "20000000-0000-4000-8000-000000000003",
      resourceId: resources[2].id,
      reservedByName: "Kasun Silva",
      reservedByEmail: "kasun@example.com",
      purpose: "Workshop demo",
      startAt: day(2, 5),
      endAt: day(2, 7),
    },
  ];

  for (const r of reservations) {
    await db.reservation.upsert({
      where: { id: r.id },
      update: {},
      create: r,
    });
  }

  // Optionally seed an admin user from environment variables.
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    await db.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: "Admin",
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
      },
    });
  }

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });