import '../core/api.dart';

/// Assistance : conversations avec le service client et foire aux questions.
class SupportService {
  static Future<List<Map<String, dynamic>>> conversations() async =>
      Api.asList(await Api.get('/customer/support'));

  static Future<Map<String, dynamic>> conversation(String id) async =>
      Api.asMap(await Api.get('/customer/support/$id'));

  static Future<Map<String, dynamic>> open({
    required String subject,
    required String message,
    String? orderId,
  }) async =>
      Api.asMap(await Api.post('/customer/support', body: {
        'subject': subject,
        'message': message,
        if (orderId != null) 'order_id': orderId,
      }));

  static Future<Map<String, dynamic>> send(String conversationId, String message) async =>
      Api.asMap(await Api.post(
        '/customer/support/$conversationId/messages',
        body: {'message': message},
      ));

  static Future<void> close(String conversationId) async =>
      Api.delete('/customer/support/$conversationId');

  static Future<List<Map<String, dynamic>>> faq() async =>
      Api.asList(await Api.get('/customer/faq'));

  /// Coordonnées et documents légaux publiés par le back-office.
  static Future<Map<String, dynamic>> appInfo() async =>
      Api.asMap(await Api.get('/customer/app-info'));
}

/// Réclamations sur une commande livrée.
class ClaimsService {
  static Future<List<Map<String, dynamic>>> list() async =>
      Api.asList(await Api.get('/customer/claims'));

  static Future<Map<String, dynamic>> detail(String id) async =>
      Api.asMap(await Api.get('/customer/claims/$id'));

  static Future<List<Map<String, dynamic>>> types() async =>
      Api.asList(await Api.get('/customer/claims/types'));

  static Future<Map<String, dynamic>> create(Map<String, dynamic> data) async =>
      Api.asMap(await Api.post('/customer/claims', body: data));

  static Future<void> cancel(String id) async => Api.delete('/customer/claims/$id');
}

/// Avis clients sur un article.
class ReviewsService {
  static Future<List<Map<String, dynamic>>> list(String articleId) async =>
      Api.asList(await Api.get('/customer/reviews/articles/$articleId'));

  static Future<Map<String, dynamic>?> mine(String articleId) async {
    final data = await Api.get('/customer/reviews/articles/$articleId/me');
    return data is Map ? Api.asMap(data) : null;
  }

  static Future<Map<String, dynamic>> submit(
    String articleId, {
    required int rating,
    String? comment,
  }) async =>
      Api.asMap(await Api.post('/customer/reviews/articles/$articleId', body: {
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      }));

  static Future<void> markHelpful(String reviewId) async =>
      Api.post('/customer/reviews/$reviewId/helpful');
}
