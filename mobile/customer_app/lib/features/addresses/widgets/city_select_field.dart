import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import '../../../core/theme/app_theme.dart';
import '../models/city_model.dart';
import '../providers/cities_provider.dart';

class CitySelectField extends ConsumerWidget {
  final String? initialCityId;
  final String? initialCityName; // kept for future, not mandatory
  final ValueChanged<CityModel> onSelected;

  const CitySelectField({
    super.key,
    this.initialCityId,
    this.initialCityName,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final citiesAsync = ref.watch(citiesProvider);

    return citiesAsync.when(
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Ville *',
              style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
          SizedBox(height: 6.h),
          Container(
            height: 52.h,
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(12.r),
            ),
            child: const Center(child: CircularProgressIndicator()),
          )
        ],
      ),
      error: (e, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Ville *',
              style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
          SizedBox(height: 6.h),
          Text('Impossible de charger les villes', style: TextStyle(fontSize: 13.sp, color: const Color(0xFFEF4444))),
        ],
      ),
      data: (cities) {
        final selectedId = (initialCityId ?? '').isNotEmpty ? initialCityId : null;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              decoration: InputDecoration(
                hintText: 'Choisir une ville',
                hintStyle: TextStyle(color: const Color(0xFF9CA3AF), fontSize: 13.sp),
                filled: true,
                fillColor: const Color(0xFFF3F4F6),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                  borderSide: const BorderSide(color: AppTheme.primary, width: 2),
                ),
                errorBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                  borderSide: const BorderSide(color: Color(0xFFEF4444)),
                ),
                focusedErrorBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12.r),
                  borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2),
                ),
                contentPadding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
              ),
              value: selectedId,
              items: cities
                  .map((c) => DropdownMenuItem<String>(
                        value: c.id,
                        child: Text(
                          '${c.nameFr}${c.nameAr != null && c.nameAr!.isNotEmpty ? ' / ${c.nameAr}' : ''}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ))
                  .toList(),
              validator: (v) => (v == null || v.isEmpty) ? 'Requis' : null,
              onChanged: (id) {
                if (id == null) return;
                final c = cities.firstWhere((x) => x.id == id);
                onSelected(c);
              },
            ),
          ],
        );
      },
    );
  }
}

