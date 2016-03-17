
lychee.define('game.app.sprite.Bullet').includes([
	'lychee.app.Sprite'
]).exports(function(lychee, game, global, attachments) {

	var _TEXTURE = attachments["png"];
	var _CONFIG  = attachments["json"].buffer;



	/*
	 * IMPLEMENTATION
	 */

	var Class = function(data) {

		var settings = lychee.extend({}, data);


		settings.collision = lychee.app.Entity.COLLISION.A;
		settings.texture   = _TEXTURE;
		settings.map       = _CONFIG.map;
		settings.radius    = _CONFIG.radius;
		settings.shape     = lychee.app.Entity.SHAPE.circle;
		settings.states    = _CONFIG.states;
		settings.state     = 'default';


		lychee.app.Sprite.call(this, settings);

		settings = null;

	};


	Class.prototype = {

		/*
		 * ENTITY API
		 */

		serialize: function() {

			var data = lychee.app.Sprite.prototype.serialize.call(this);
			data['constructor'] = 'game.app.sprite.Bullet';


			return data;

		}

	};


	return Class;

});
