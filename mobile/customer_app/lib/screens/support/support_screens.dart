import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../i18n/i18n.dart';
import '../../services/support_service.dart';
import '../../theme/atina.dart';
import '../../theme/widgets.dart';

/// Mes conversations avec le service client.
class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await SupportService.conversations();
      if (mounted) setState(() => _items = list);
    } catch (_) {
      if (mounted) setState(() => _items = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _newConversation() async {
    final subject = TextEditingController();
    final message = TextEditingController();

    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: C.bg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(S.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t('Nouvelle demande'), style: ts(16, weight: F.bold)),
              const SizedBox(height: S.md),
              TextField(
                controller: subject,
                style: ts(14),
                decoration: InputDecoration(labelText: t('Sujet')),
              ),
              const SizedBox(height: S.md),
              TextField(
                controller: message,
                maxLines: 4,
                style: ts(14),
                decoration: InputDecoration(labelText: t('Votre message')),
              ),
              const SizedBox(height: S.lg),
              PrimaryButton(
                label: t('Envoyer'),
                onPressed: () async {
                  if (message.text.trim().isEmpty) return;
                  await SupportService.open(
                    subject: subject.text.trim().isEmpty
                        ? t('Demande client')
                        : subject.text.trim(),
                    message: message.text.trim(),
                  );
                  if (context.mounted) Navigator.of(context).pop(true);
                },
              ),
            ],
          ),
        ),
      ),
    );

    subject.dispose();
    message.dispose();
    if (sent == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Chat avec le support'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
            right: IconButton(
              tooltip: t('Nouvelle demande'),
              onPressed: _newConversation,
              icon: const Icon(Icons.add_comment_outlined, color: C.red),
            ),
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
                                icon: Icons.chat_bubble_outline,
                                title: t('Aucune conversation'),
                                text: t('Notre équipe répond à vos questions.'),
                                actionLabel: t('Nouvelle demande'),
                                onAction: _newConversation,
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                            itemCount: _items.length,
                            separatorBuilder: (_, __) => const Divider(height: 1),
                            itemBuilder: (context, i) {
                              final item = _items[i];
                              final date = DateTime.tryParse('${item['updated_at'] ?? item['created_at']}');
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                onTap: () => context.push('/support/chat/${item['id']}'),
                                leading: Container(
                                  width: 38,
                                  height: 38,
                                  decoration: const BoxDecoration(
                                      color: C.redSoft, shape: BoxShape.circle),
                                  child: const Icon(Icons.support_agent,
                                      size: 20, color: C.red),
                                ),
                                title: Text('${item['subject'] ?? t('Demande client')}',
                                    style: ts(14, weight: F.semi)),
                                subtitle: date == null
                                    ? null
                                    : Text(fmtDate(date), style: ts(12, color: C.grey)),
                                trailing: const Icon(Icons.chevron_right,
                                    size: 20, color: C.greyLight),
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

/// Fil d'une conversation : messages et zone de saisie.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  Map<String, dynamic> _conversation = const {};
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await SupportService.conversation(widget.conversationId);
      if (mounted) setState(() => _conversation = data);
    } catch (_) {
      // Fil indisponible : la zone de saisie reste utilisable.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await SupportService.send(widget.conversationId, text);
      _input.clear();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e', style: ts(13.5, color: Colors.white))),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = (_conversation['messages'] as List?)
            ?.whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList() ??
        const <Map<String, dynamic>>[];

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: '${_conversation['subject'] ?? t('Chat')}',
            onBack: () =>
                context.canPop() ? context.pop() : context.go('/support/conversations'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : messages.isEmpty
                    ? EmptyState(
                        icon: Icons.chat_bubble_outline,
                        title: t('Aucun message'),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                        itemCount: messages.length,
                        itemBuilder: (context, i) {
                          final message = messages[i];
                          final mine = message['sender_type'] == 'customer' ||
                              message['is_customer'] == true;
                          return Align(
                            alignment:
                                mine ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: S.sm),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: S.md, vertical: 10),
                              constraints: BoxConstraints(
                                maxWidth: MediaQuery.sizeOf(context).width * 0.75,
                              ),
                              decoration: BoxDecoration(
                                color: mine ? C.red : C.bgSoft,
                                borderRadius: BorderRadius.circular(R.md),
                              ),
                              child: Text(
                                '${message['message'] ?? message['body'] ?? ''}',
                                style: ts(13.5,
                                    color: mine ? Colors.white : C.ink, height: 1.45),
                              ),
                            ),
                          );
                        },
                      ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              S.lg,
              S.sm,
              S.lg,
              MediaQuery.paddingOf(context).bottom + S.sm,
            ),
            decoration: const BoxDecoration(
              color: C.bg,
              border: Border(top: BorderSide(color: C.line)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    style: ts(14),
                    decoration: InputDecoration(hintText: t('Votre message')),
                  ),
                ),
                const SizedBox(width: S.sm),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  style: IconButton.styleFrom(backgroundColor: C.red),
                  icon: _sending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send, size: 18, color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Foire aux questions, repliable par question.
class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    SupportService.faq().then((list) {
      if (mounted) {
        setState(() {
          _items = list;
          _loading = false;
        });
      }
    }).catchError((Object _) {
      if (mounted) setState(() => _loading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('FAQ'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : _items.isEmpty
                    ? EmptyState(
                        icon: Icons.help_outline,
                        title: t('Aucune question pour le moment'),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, 100),
                        itemCount: _items.length,
                        itemBuilder: (context, i) {
                          final item = _items[i];
                          return Theme(
                            data: Theme.of(context)
                                .copyWith(dividerColor: Colors.transparent),
                            child: ExpansionTile(
                              tilePadding: EdgeInsets.zero,
                              iconColor: C.red,
                              collapsedIconColor: C.grey,
                              title: Text(
                                '${item['question_fr'] ?? item['question'] ?? ''}',
                                style: ts(14, weight: F.semi),
                              ),
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(bottom: S.md),
                                  child: Text(
                                    '${item['answer_fr'] ?? item['answer'] ?? ''}',
                                    style: ts(13.5, color: C.body, height: 1.55),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

/// Contact : téléphone, e-mail et horaires publiés par le back-office.
class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});

  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  Map<String, dynamic> _info = const {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    SupportService.appInfo().then((data) {
      if (mounted) {
        setState(() {
          _info = data;
          _loading = false;
        });
      }
    }).catchError((Object _) {
      if (mounted) setState(() => _loading = false);
    });
  }

  Future<void> _open(String scheme, String value) async {
    final uri = Uri(scheme: scheme, path: value);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    final phone = (_info['support_phone'] ?? _info['phone']) as String?;
    final email = (_info['support_email'] ?? _info['email']) as String?;

    return Scaffold(
      backgroundColor: C.bg,
      body: Column(
        children: [
          ScreenHeader(
            title: t('Contact'),
            onBack: () => context.canPop() ? context.pop() : context.go('/profile'),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: C.red))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(S.lg, S.sm, S.lg, S.lg),
                    children: [
                      if (phone != null && phone.isNotEmpty)
                        _tile(Icons.phone_outlined, t('Téléphone'), phone,
                            () => _open('tel', phone)),
                      if (email != null && email.isNotEmpty)
                        _tile(Icons.mail_outline, t('E-mail'), email,
                            () => _open('mailto', email)),
                      _tile(
                        Icons.chat_bubble_outline,
                        t('Chat avec le support'),
                        t('Notre équipe répond à vos questions.'),
                        () => context.push('/support/conversations'),
                      ),
                      if (phone == null && email == null)
                        EmptyState(
                          icon: Icons.headset_mic_outlined,
                          title: t('Coordonnées indisponibles'),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _tile(IconData icon, String title, String value, VoidCallback onTap) => Card(
        color: C.bg,
        elevation: 0,
        margin: const EdgeInsets.only(bottom: S.md),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(R.md),
          side: const BorderSide(color: C.line),
        ),
        child: ListTile(
          onTap: onTap,
          leading: Icon(icon, color: C.red),
          title: Text(title, style: ts(14, weight: F.semi)),
          subtitle: Text(value, style: ts(12.5, color: C.grey)),
          trailing: const Icon(Icons.chevron_right, size: 20, color: C.greyLight),
        ),
      );
}
