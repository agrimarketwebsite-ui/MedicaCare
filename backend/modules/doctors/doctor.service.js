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

export default { listDoctors, getDoctorById, listSpecialties };
