import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api.dart';
import '../../i18n/i18n.dart';
import '../../services/auth_service.dart';
import '../../services/profile_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Modifier mon profil : nom et adresse e-mail.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await ProfileService.get();
      if (!mounted) return;
      _name.text = (profile['name'] as String?) ?? '';
      _email.text = (profile['email'] as String?) ?? '';
    } catch (_) {
      // Les champs restent vides ; l'enregistrement fonctionnera quand même.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _message = '';
    });
    try {
      await ProfileService.update({
        'name': _name.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      });
      if (mounted) setState(() => _message = t('Modifications enregistrées'));
    } on ApiError catch (e) {
      setState(() => _message = e.message);
    } catch (_) {
      setState(() => _message = t('Erreur réseau'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Modifier profil'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                    children: [
                      TextField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        style: ts(14),
                        decoration: InputDecoration(labelText: t('Nom complet')),
                      ),
                      const SizedBox(height: S.md),
                      TextField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        style: ts(14),
                        decoration: InputDecoration(labelText: t('E-mail')),
                      ),
                      if (_message.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: S.md),
                          child: Text(
                            _message,
                            style: ts(12.5,
                                weight: F.medium,
                                color: _message == t('Modifications enregistrées')
                                    ? C.green
                                    : C.red),
                          ),
                        ),
                      const SizedBox(height: S.xl),
                      PrimaryButton(
                        label: t('Enregistrer les modifications'),
                        loading: _saving,
                        onPressed: _save,
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// Choix de la langue depuis les réglages : bascule immédiate, sans redémarrage.
class LanguageSettingsScreen extends StatefulWidget {
  const LanguageSettingsScreen({super.key});

  @override
  State<LanguageSettingsScreen> createState() => _LanguageSettingsScreenState();
}

class _LanguageSettingsScreenState extends State<LanguageSettingsScreen> {
  late String _lang = I18n.lang;

  Future<void> _apply(String lang) async {
    setState(() => _lang = lang);
    await I18n.setLanguage(lang);
    // Le choix suit le compte quand le serveur répond ; sinon il reste local.
    try {
      await ProfileService.update({'preferred_lang': lang});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Langue'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
              children: [
                _tile('fr', 'Français', 'flag_fr'),
                const SizedBox(height: S.md),
                _tile('ar', 'العربية', 'flag_ma'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tile(String code, String label, String flag) {
    final active = _lang == code;
    return InkWell(
      onTap: () => _apply(code),
      borderRadius: BorderRadius.circular(R.md),
      child: Container(
        padding: const EdgeInsets.all(S.md),
        decoration: BoxDecoration(
          color: active ? C.redSoft : C.bg,
          borderRadius: BorderRadius.circular(R.md),
          border: Border.all(color: active ? C.red : C.line),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: Image.asset('assets/images/atina/$flag.png',
                  width: 26, height: 18, fit: BoxFit.cover),
            ),
            const SizedBox(width: S.md),
            Expanded(
              child: Text(label,
                  style: ts(15, weight: F.semi, color: active ? C.red : C.ink)),
            ),
            if (active) const Icon(Icons.check_circle, size: 18, color: C.red),
          ],
        ),
      ),
    );
  }
}

/// Notifications reçues (promotions, commandes, jeux).
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ProfileService.notifications();
      if (mounted) setState(() => _items = list);
    } catch (_) {
      if (mounted) setState(() => _items = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Notifications'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : RefreshIndicator(
                    color: C.red,
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? ListView(
                            children: [
                              EmptyState(
                                icon: Icons.notifications_none,
                                title: t('Aucune notification'),
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                            itemCount: _items.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (context, i) {
                              final item = _items[i];
                              final date = DateTime.tryParse('${item['created_at']}');
                              final unread =
                                  item['read_at'] == null && item['is_read'] != true;
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: unread ? C.redSoft : C.bgSoft,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(Icons.notifications_none,
                                      size: 18, color: unread ? C.red : C.grey),
                                ),
                                title: Text(
                                  '${item['title'] ?? item['title_fr'] ?? ''}',
                                  style: ts(14, weight: unread ? F.semi : F.regular),
                                ),
                                subtitle: Text(
                                  '${item['body'] ?? item['message'] ?? ''}',
                                  style: ts(12.5, color: C.grey, height: 1.4),
                                ),
                                trailing: date == null
                                    ? null
                                    : Text(fmtDate(date, pattern: 'd MMM'),
                                        style: ts(11, color: C.greyLight)),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Suppression du compte : confirmation par code reçu par SMS.
class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _otp = TextEditingController();
  bool _requested = false;
  bool _busy = false;
  String _message = '';

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      await Api.post('/customer/me/delete-account/request-otp');
      if (mounted) {
        setState(() {
          _requested = true;
          _message = t('Un code vous a été envoyé par SMS.');
        });
      }
    } on ApiError catch (e) {
      setState(() => _message = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm() async {
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      await Api.post('/customer/me/delete-account', body: {'otp': _otp.text.trim()});
      await AuthService.logout();
      if (mounted) context.go('/auth/login');
    } on ApiError catch (e) {
      setState(() => _message = e.message);
    } catch (_) {
      setState(() => _message = t('Erreur réseau'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Supprimer mon compte'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
              children: [
                Container(
                  padding: const EdgeInsets.all(S.md),
                  decoration: BoxDecoration(
                    color: C.redSoft,
                    borderRadius: BorderRadius.circular(R.md),
                  ),
                  child: Text(
                    t('Cette action est définitive : vos commandes, points et coupons seront supprimés.'),
                    style: ts(13, color: C.red, height: 1.5),
                  ),
                ),
                const SizedBox(height: S.xl),
                if (_requested)
                  TextField(
                    controller: _otp,
                    keyboardType: TextInputType.number,
                    style: ts(14),
                    decoration: InputDecoration(labelText: t('Code reçu par SMS')),
                  ),
                if (_message.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: S.md),
                    child: Text(_message,
                        style: ts(12.5, weight: F.medium, color: C.red)),
                  ),
                const SizedBox(height: S.xl),
                PrimaryButton(
                  label: _requested ? t('Confirmer la suppression') : t('Recevoir le code'),
                  loading: _busy,
                  onPressed: _requested ? _confirm : _request,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
