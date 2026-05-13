import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../models/address_model.dart';
import '../widgets/city_select_field.dart';
import '../../profile/providers/profile_provider.dart';

// Uses cities API for the Ville select (GET /api/cities?all=true)



class AddressFormScreen extends ConsumerStatefulWidget {
  final AddressModel? editAddress; // null = create mode
  const AddressFormScreen({super.key, this.editAddress});

  @override
  ConsumerState<AddressFormScreen> createState() => _State();
}

class _State extends ConsumerState<AddressFormScreen> {
  final _formKey       = GlobalKey<FormState>();
  final _streetCtrl    = TextEditingController();
  final _streetNumCtrl = TextEditingController();
  final _quartierCtrl  = TextEditingController();
  final _postalCtrl    = TextEditingController();

  String? _selectedCityId;
  String? _selectedCityName;





  final _notesCtrl     = TextEditingController();


  String _label      = 'Maison';
  bool   _isDefault  = false;
  bool   _loading    = false;

  bool get _isEdit => widget.editAddress != null;

  static const _labels = ['Maison', 'Travail', 'Autre'];

  @override
  void initState() {
    super.initState();
    final a = widget.editAddress;
    if (a != null) {
      _label          = _labels.contains(a.displayLabel) ? a.displayLabel : 'Autre';
      _streetNumCtrl.text = a.streetNumber ?? '';
      _streetCtrl.text    = a.streetName;
      _quartierCtrl.text  = a.quartier ?? '';
      _postalCtrl.text    = a.postalCode ?? '';
      _selectedCityId    = a.cityId ?? '';
      _selectedCityName  = a.city;

      _notesCtrl.text     = a.deliveryNotes ?? '';
      _isDefault          = a.isDefault;
    }
  }

  @override
  void dispose() {
    for (final c in [_streetCtrl, _streetNumCtrl, _quartierCtrl, _postalCtrl, _notesCtrl]) {
      c.dispose();
    }
    super.dispose();
  }


  Future<void> _submit() async {
    if (_selectedCityId == null || _selectedCityId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Ville requise', style: TextStyle(color: Colors.white)),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          margin: EdgeInsets.all(16.w),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }

    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _loading = true);

    final body = <String, dynamic>{
      'label':          _label,
      'street_number':  _streetNumCtrl.text.trim().isEmpty ? null : _streetNumCtrl.text.trim(),
      'street_name':    _streetCtrl.text.trim(),
      'quartier':       _quartierCtrl.text.trim().isEmpty ? null : _quartierCtrl.text.trim(),
      // Backend expects `city` name or city id (if supported).
      // We always send `city` using the selected city name.
      'city':           (_selectedCityName ?? '').trim(),
      'city_id':       (_selectedCityId ?? '').trim().isEmpty ? null : _selectedCityId,
      'postal_code':    _postalCtrl.text.trim().isEmpty ? null : _postalCtrl.text.trim(),
      'delivery_notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      'is_default':     _isDefault,
    };


    bool ok;
    if (_isEdit) {
      ok = await ref.read(addressesProvider.notifier).update(widget.editAddress!.id, body);
    } else {
      ok = await ref.read(addressesProvider.notifier).create(body);
    }

    if (mounted) {
      setState(() => _loading = false);
      if (ok) {
        _showSnack(_isEdit ? 'Adresse mise à jour' : 'Adresse créée', true);
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) context.pop();
      } else {
        _showSnack('Erreur lors de la sauvegarde', false);
      }
    }
  }

  void _showSnack(String msg, bool success) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content:         Text(msg, style: const TextStyle(color: Colors.white)),
      backgroundColor: success ? AppTheme.success : const Color(0xFFEF4444),
      behavior:        SnackBarBehavior.floating,
      margin:          EdgeInsets.all(16.w),
      shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
      duration:        const Duration(seconds: 2),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F5F5),
        appBar: AppBar(
          backgroundColor:  Colors.white,
          elevation:        0,
          surfaceTintColor: Colors.transparent,
          leading:          IconButton(icon: const Icon(Icons.arrow_back_ios_rounded, size: 20), onPressed: () => context.pop()),
          title:            Text(_isEdit ? 'Modifier l\'adresse' : 'Nouvelle adresse',
              style: TextStyle(fontSize: 17.sp, fontWeight: FontWeight.w700, color: const Color(0xFF111827))),
          centerTitle: true,
        ),
        body: SingleChildScrollView(
          padding: EdgeInsets.all(16.w),
          child: Form(
            key: _formKey,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

              // Label selector
              _Section('Type d\'adresse', child: Row(children: _labels.map((l) {
                final sel = _label == l;
                return Expanded(child: Padding(
                  padding: EdgeInsets.only(right: l != _labels.last ? 8.w : 0),
                  child: GestureDetector(
                    onTap: () => setState(() => _label = l),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      height:   46.h,
                      decoration: BoxDecoration(
                        color:        sel ? AppTheme.primary : const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(12.r),
                        border:       Border.all(color: sel ? AppTheme.primary : const Color(0xFFE5E7EB), width: 1.5),
                      ),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Icon(_labelIcon(l), size: 16.sp, color: sel ? Colors.white : const Color(0xFF6B7280)),
                        SizedBox(height: 2.h),
                        Text(l, style: TextStyle(fontSize: 11.sp, fontWeight: FontWeight.w600, color: sel ? Colors.white : const Color(0xFF374151))),
                      ]),
                    ),
                  ),
                ));
              }).toList())),

              SizedBox(height: 16.h),

              // Address fields card
              _Card(children: [
                Row(children: [
                  SizedBox(
                    width: 90.w,
                    child: _Field(ctrl: _streetNumCtrl, label: 'N°', hint: '12', action: TextInputAction.next),
                  ),
                  SizedBox(width: 12.w),
                  Expanded(child: _Field(ctrl: _streetCtrl, label: 'Rue *', hint: 'Rue Hassan II', action: TextInputAction.next,
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Requis' : null)),
                ]),
                SizedBox(height: 14.h),
                _Field(ctrl: _quartierCtrl, label: 'Quartier', hint: 'Agdal', action: TextInputAction.next),
                SizedBox(height: 14.h),
                Row(children: [
                  Expanded(
                    child: CitySelectField(
                      initialCityId: _selectedCityId,
                      initialCityName: _selectedCityName,
                      onSelected: (city) {
                        setState(() {
                          _selectedCityId = city.id;
                          _selectedCityName = city.nameFr;
                          _postalCtrl.text = city.postalCode;
                        });
                      },
                    ),
                  ),
                  SizedBox(width: 12.w),
                  SizedBox(
                    width: 100.w,
                    child: _Field(
                      ctrl: _postalCtrl,
                      label: 'Code postal',
                      hint: '10000',
                      keyboard: TextInputType.number,
                      action: TextInputAction.next,
                    ),
                  ),
                ]),

                SizedBox(height: 14.h),
                _Field(
                  ctrl: _notesCtrl, label: 'Notes de livraison',
                  hint: 'Ex: Sonnez au 2ème étage…', action: TextInputAction.done,
                  maxLines: 3,
                ),
              ]),

              SizedBox(height: 12.h),

              // Default switch
              Container(
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14.r)),
                child: SwitchListTile(
                  value:           _isDefault,
                  onChanged:       (v) => setState(() => _isDefault = v),
                  activeThumbColor: AppTheme.primary,
                  activeTrackColor: AppTheme.primary.withValues(alpha: 0.4),
                  title:           Text('Adresse par défaut', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
                  subtitle:        Text('Utilisée automatiquement lors du checkout', style: TextStyle(fontSize: 12.sp, color: const Color(0xFF9CA3AF))),
                  contentPadding:  EdgeInsets.symmetric(horizontal: 16.w, vertical: 4.h),
                  shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(14.r)),
                ),
              ),

              SizedBox(height: 28.h),

              // Submit button
              SizedBox(
                width:  double.infinity,
                height: 54.h,
                child: _loading
                    ? Container(
                        decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(16.r)),
                        child: const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 2.5))),
                      )
                    : ElevatedButton.icon(
                        onPressed: _submit,
                        icon:      Icon(Icons.check_rounded, size: 20.sp),
                        label:     Text(_isEdit ? 'Enregistrer les modifications' : 'Ajouter l\'adresse', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w700)),
                        style:     ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.r)),
                          elevation:       0,
                        ),
                      ),
              ),

              SizedBox(height: MediaQuery.of(context).viewInsets.bottom + 16.h),
            ]),
          ),
        ),
      ),
    );
  }

  IconData _labelIcon(String l) {
    switch (l) {
      case 'Maison':  return Icons.home_rounded;
      case 'Travail': return Icons.work_rounded;
      default:        return Icons.location_on_rounded;
    }
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section(this.title, {required this.child});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w700, color: const Color(0xFF6B7280))),
    SizedBox(height: 10.h),
    child,
  ]);
}

class _Card extends StatelessWidget {
  final List<Widget> children;
  const _Card({required this.children});

  @override
  Widget build(BuildContext context) => Container(
    padding:     EdgeInsets.all(16.w),
    decoration:  BoxDecoration(
      color:        Colors.white,
      borderRadius: BorderRadius.circular(16.r),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );
}

class _Field extends StatelessWidget {
  final TextEditingController ctrl;
  final String                label;
  final String                hint;
  final TextInputAction       action;
  final TextInputType?        keyboard;
  final int                   maxLines;
  final String? Function(String?)? validator;

  const _Field({
    required this.ctrl,
    required this.label,
    required this.hint,
    required this.action,
    this.keyboard,
    this.maxLines = 1,
    this.validator,
  });

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.w600, color: const Color(0xFF374151))),
    SizedBox(height: 6.h),
    TextFormField(
      controller:      ctrl,
      keyboardType:    keyboard,
      textInputAction: action,
      maxLines:        maxLines,
      style:           TextStyle(fontSize: 14.sp, color: const Color(0xFF111827)),
      decoration: InputDecoration(
        hintText:   hint,
        hintStyle:  TextStyle(color: const Color(0xFF9CA3AF), fontSize: 13.sp),
        filled:     true,
        fillColor:  const Color(0xFFF3F4F6),
        border:          OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: BorderSide.none),
        focusedBorder:   OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: AppTheme.primary, width: 2)),
        errorBorder:     OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFEF4444))),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12.r), borderSide: const BorderSide(color: Color(0xFFEF4444), width: 2)),
        contentPadding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
      ),
      validator: validator,
    ),
  ]);
}
