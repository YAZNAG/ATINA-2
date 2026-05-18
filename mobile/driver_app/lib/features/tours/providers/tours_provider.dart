import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/tours_api.dart';
import '../models/tour_model.dart';
import '../models/stop_model.dart';

final _api = ToursApi.instance;

// ── Tours list ────────────────────────────────────────────────────────────────
final toursProvider = FutureProvider<List<TourModel>>((ref) => _api.getMyTours());

// ── Single tour ───────────────────────────────────────────────────────────────
final tourProvider = FutureProvider.family<TourModel, String>((ref, id) => _api.getTour(id));

// ── Single stop ───────────────────────────────────────────────────────────────
final stopProvider = FutureProvider.family<TourStopModel, String>((ref, id) => _api.getStop(id));
