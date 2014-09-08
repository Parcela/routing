/*global describe, it , beforeEach, afterEach*/
"use strict";
var expect = require('chai').expect;


(function (window) {
	var routing = require('../routing.js')(window),
		Parcel = require('parcel');

	var P1 = Parcel.subClass({
		view: function () {
			return 'P1';
		}
	});
	var P2 = Parcel.subClass({
		view: function () {
			return 'P2';
		}
	});
	var q = function() {};
	
	var mock = window.navigator.userAgent === 'fake' && window.navigator;
	if (!mock) {
		q = function (sel) {
			return window.document.querySelector(sel);
		};
	}

	describe('Initial routing:', function () {

		it('default route:', function () {
			if (mock) mock.reset();

			routing.setRoutes({
				'/p1':P1,
				'/p2':P2
			}, '/p1');

			if (mock) {
				var html = mock.getHTML();
				expect(html).eql('<BODY><DIV class="parcel">P1</DIV></BODY>');
			} else {
				expect(q('.parcel').innerHTML).eql('P1');
			}
		});
		if (mock) {
			// can't make it work with the actual browser
			it('specific route:', function () {
				mock.reset();

				mock.navigate('?/p2');
				
				routing.setRoutes({
					'/p1':P1,
					'/p2':P2
				}, '/p1');

				if (mock) {
					var html = mock.getHTML();
					expect(html).eql('<BODY><DIV class="parcel">P2</DIV></BODY>');
				} else {
					expect(q('.parcel').innerHTML).eql('P2');
				}
			});
			it('route with param', function () {
				mock.reset();
				
				mock.navigate('?/p/123');
				
				routing.setRoutes({
					'/p/:id': Parcel.subClass({
						init: function (config) {
							expect(config).eql({route:'/p/123',id:'123'});
						},
						view: function () {
							expect(this.route).eql('/p/123');
							expect(this.id).eql('123');
						}
							
					})
				});
			});
			it('route with wildcard', function () {
				mock.reset();
				
				mock.navigate('?/p/12/3/other/456');
				routing.setRoutes({
					'/p/:several*/other/:id': Parcel.subClass({
						init: function (config) {
							expect(config).eql({route:'/p/12/3/other/456',id:'456', several:'12/3'});
						},
						view: function () {
							expect(this.route).eql('/p/12/3/other/456');
							expect(this.id).eql('456');
							expect(this.several).eql('12/3');
						}
							
					})
				});
			});
			it('route in hash mode with query string', function () {
				mock.reset();
				
				mock.navigate('#/p/123?a=b&c=d');
				routing.setRoutes({
					'/p/:id': Parcel.subClass({
						init: function (config) {
							expect(config).eql({route:'/p/123',id:'123',a:'b',c:'d'});
						},
						view: function () {
							expect(this.route).eql('/p/123');
							expect(this.id).eql('123');
							expect(this.a).eql('b');
							expect(this.c).eql('d');
						}
							
					})
				}, 'hash');
			});
			it('route in pathname mode with query string', function () {
				mock.reset();
				
				mock.navigate('/p/789?a=b&c=d');
				routing.setRoutes({
					'/p/:id': Parcel.subClass({
						init: function (config) {
							expect(config).eql({route:'/p/789',id:'789',a:'b',c:'d'});
						},
						view: function () {
							expect(this.route).eql('/p/789');
							expect(this.id).eql('789');
							expect(this.a).eql('b');
							expect(this.c).eql('d');
						}
							
					})
				},'pathname');
			});
		}
	});
})(global.window || require('fake-dom')());