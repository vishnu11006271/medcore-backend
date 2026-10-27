
import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function main() {
  const email = 'patient1@example.com';
  const hospitalId = process.env.PATIENT_HOSPITAL_ID;

  if (!hospitalId) {
    throw new Error(
      'Set PATIENT_HOSPITAL_ID to a verified hospital ID before running.',
    );
  }

  const prisma = new PrismaService();

  try {
    await prisma.$connect();

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email },
        include: { patientProfile: true },
      });

      if (!user) {
        throw new Error(`User ${email} was not found.`);
      }

      if (user.role !== 'PATIENT') {
        throw new Error('The account does not have the PATIENT role.');
      }

      if (user.patientProfile) {
        console.log('Patient profile already exists:', user.patientProfile.id);
        return;
      }

      const hospital = await tx.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, status: true },
      });

      if (!hospital || hospital.status !== 'VERIFIED') {
        throw new Error('The specified hospital does not exist or is not verified.');
      }

      const patientNumber = `PAT-${crypto.randomUUID()}`;

      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          hospitalId: hospital.id,
          patientNumber,
        },
      });

      console.log('Patient profile created:', {
        patientId: patient.id,
        userId: patient.userId,
        hospitalId: patient.hospitalId,
        patientNumber: patient.patientNumber,
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Patient profile repair failed:', error);
  process.exitCode = 1;
});
