const svc = require('./customer_games.service');
const resp = require('../../utils/response');

class CustomerGamesController {
  /** GET /customer/games?node_id= */
  async index(req, res, next) {
    try {
      const nodeId = req.query.node_id || req.headers['x-node-id'] || null;
      return resp.success(res, await svc.listGames(req.customerId, { node_id: nodeId }));
    } catch (e) { next(e); }
  }

  /** GET /customer/games/prizes — « Mes gains » */
  async prizes(req, res, next) {
    try { return resp.success(res, await svc.myPrizes(req.customerId)); } catch (e) { next(e); }
  }

  /** POST /customer/games/:id/play — body { order_id? } */
  async play(req, res, next) {
    try {
      const data = await svc.playGame(req.customerId, req.params.id, { order_id: req.body?.order_id || null });
      return resp.success(res, data, data.message, 201);
    } catch (e) { next(e); }
  }
}

module.exports = new CustomerGamesController();
