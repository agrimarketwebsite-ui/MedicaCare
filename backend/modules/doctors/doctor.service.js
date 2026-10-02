// backend/modules/doctors/doctor.service.js
// Phase 3 — public directory logic: specialty filter (uuid o name), search,
// status filter, pagination, at rating merge mula sa
// v_doctor_rating_averages (laging may review count kapag may rating).

import ApiError from '../../shared/utils/ApiError.js';
import * as repo from './doctor.repository.js';
import { isUuid } from './doctor.validation.js';

function toPublicDoctor(row, ratingsMap) {
  const rating = ratingsMap.get(row.id);
  return {
    id: row.id,
    full_name: row.full_name,
    specialty_id: row.specialty_id,
    specialty_name: row.specialties?.name ?? null,
    status: row.status,
    years_of_experience: row.years_of_experience,
    consultation_fee: Number(row.consultation_fee),
    room: row.room,
    gender: row.gender,
    photo_url: row.photo_url,
    // Walang ratings → null/0 (hindi 0-star na misleading).
    avg_rating: rating ? rating.avg_rating : null,
    rating_count: rating ? rating.rating_count : 0,
  };
}

async function withRatings(rows) {
  const map = await repo.getRatingsFor(rows.map((r) => r.id));
  return rows.map((r) => toPublicDoctor(r, map));
}

export async function listDoctors({ specialty, search, status, limit, offset }) {
  let specialtyId = null;
  if (specialty) {
    if (isUuid(specialty)) {
      specialtyId = specialty;
    } else {
      const spec = await repo.findSpecialtyByName(specialty);
      if (!spec) return { doctors: [], total: 0, limit, offset };
      specialtyId = spec.id;
    }
  }

  let searchSpecialtyIds = [];
  if (search) {
    searchSpecialtyIds = await repo.findSpecialtyIdsByName(search);
  }

  const { rows, total } = await repo.listDoctors({
    specialtyId,
    status,
    search,
    searchSpecialtyIds,
    limit,
    offset,
  });
  return { doctors: await withRatings(rows), total, limit, offset };
}

export async function getDoctorById(id) {
  const row = await repo.getDoctorById(id);
  if (!row) throw ApiError.notFound('Doctor not found');
  const [doctor] = await withRatings([row]);
  return { doctor };
}

export async function listSpecialties() {
  const specialties = await repo.listSpecialties();
  return { specialties };
}

// ------------------------------------------------------------
// Phase 5 — doctor portal (own profile + weekly availability).
// ------------------------------------------------------------

/**
 * JWT.sub (doctor_accounts.id) → doctors.id. LAHAT ng doctor-scoped
 * endpoints ay dumadaan dito — ang doctor ay nakikita lang ang SARILING
 * schedule/pasyente (BOLA). Kapag walang account (revoked), ang session ay
 * stale → 401.
 */
export async function resolveDoctorId(accountId) {
  const doctorId = await repo.getDoctorIdByAccountId(accountId);
  if (!doctorId) throw ApiError.unauthorized('Session revoked — please log in again');
  return doctorId;
}

/** Own profile: doctor row + specialty + rating average. */
export async function getOwnProfile(accountId) {
  const doctorId = await resolveDoctorId(accountId);
  const row = await repo.getOwnDoctor(doctorId);
  if (!row) throw ApiError.notFound('Doctor profile not found');
  const [doctor] = await withRatings([row]);
  return {
    doctor: {
      ...doctor,
      email: row.email ?? null,
    },
  };
}

/** Own weekly availability (pinagmumulan ng fn_available_slots). */
export async function listOwnAvailability(accountId) {
  const doctorId = await resolveDoctorId(accountId);
  const availability = await repo.listAvailability(doctorId);
  return { availability };
}

export async function createAvailability(accountId, input) {
  const doctorId = await resolveDoctorId(accountId);
  try {
    const entry = await repo.createAvailability(doctorId, input);
    return { entry };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('An availability entry already exists for this weekday and start time.');
    }
    throw err;
  }
}

export async function updateAvailability(accountId, id, patch) {
  const doctorId = await resolveDoctorId(accountId);
  if (Object.keys(patch).length === 0) {
    const rows = await repo.listAvailability(doctorId);
    const entry = rows.find((r) => r.id === id);
    if (!entry) throw ApiError.notFound('Availability entry not found');
    return { entry };
  }
  try {
    const entry = await repo.updateAvailability(doctorId, id, patch);
    if (!entry) throw ApiError.notFound('Availability entry not found'); // hindi kanya → 404
    return { entry };
  } catch (err) {
    if (err.code === '23505') {
      throw ApiError.conflict('An availability entry already exists for this weekday and start time.');
    }
    throw err;
  }
}

export async function deleteAvailability(accountId, id) {
  const doctorId = await resolveDoctorId(accountId);
  const deleted = await repo.deleteAvailability(doctorId, id);
  if (!deleted) throw ApiError.notFound('Availability entry not found'); // hindi kanya → 404
}

export default { listDoctors, getDoctorById, listSpecialties, resolveDoctorId, getOwnProfile, listOwnAvailability, createAvailability, updateAvailability, deleteAvailability };
