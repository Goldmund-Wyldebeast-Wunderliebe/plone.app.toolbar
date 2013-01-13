// overlay based on bootstrap modal
//
// Author: Rok Garbas
// Contact: rok@garbas.si
// Version: 1.0
// Depends:
//    ++resource++plone.app.jquery.js
//    ++resource++plone.app.toolbar/lib/jquery.form.js
//    (optional)++resource++plone.app.toolbar/src/jquery.iframe.js
//    (optional)++resource++plone.app.toolbar/src/jquery.mask.js
//
// Description: 
//    This script is used to provide glue code between iframe and twitter
//    bootstrap modal. And also providing some convinience method for usage in
//    Plone.
//
// License:
//
// Copyright (C) 2010 Plone Foundation
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program; if not, write to the Free Software Foundation, Inc., 51
// Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//

/*jshint bitwise:true, curly:true, eqeqeq:true, immed:true, latedef:true,
  newcap:true, noarg:true, noempty:true, nonew:true, plusplus:true,
  undef:true, strict:true, trailing:true, browser:true */
/*global tinyMCE:false, TinyMCEConfig:false */


(function ($, undefined) {
"use strict";

// Constructor
var PloneOverlay = function(el, options) { this.init(el, options); };
PloneOverlay.prototype = {

  init: function(el, options) {
    var self = this;

    // we don't have to initialize if overlay is already initialized
    if (self.el) { return; }

    // no element is passed
    if (options === undefined) {
      options = el;
      el = undefined;
    }

    // merge options with defaults
    options = $.extend({}, $.fn.ploneOverlay.defaults,
        typeof options === 'object' && options);

    // store options on instance
    self.options = options;
    self._el = el;

    // element "a" can also give us info where to load modal content from
    if (self._el && $.nodeName(self._el[0], 'a') && !self.options.el) {
      options.el = el.attr('href');
    }

    // if el option passed in then we overrive el
    if (options.el) {
      el = options.el;
    }

    // element "a" will also trigger showing of overlay when clicked
    if (self._el && $.nodeName(self._el[0], 'a')) {
      self._el.off('click').on('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        self.show();
      });
    }

    // custom function which will get resolved on first call
    if (typeof el === 'function') {
      self.el = el;

    // if el is string its ment to be url
    } else if (typeof el === 'string') {
      self.el = function(callback) {
        var self = this;

        // before ajax request hook
        if (self.options.onBeforeLoad) {
          self.options.onBeforeLoad.call(self);
        }

        // remove hash part of url and append prefix to url, eg.
        //   convert -> http://example.com/something
        //   into    -> http://example.com/++unthemed++/something
        var ajaxURL = self.options.changeAjaxURL((el.match(/^([^#]+)/) || [])[1]);

        // do ajax request with prefixed url
        $.get(ajaxURL, {}, function(response) {

          // from response get content of body
          self.el = $('<div/>').html((/<body[^>]*>((.|[\n\r])*)<\/body>/im).exec(response)[1]);

          // after ajax request hook
          if (self.options.onLoaded) {
            self.options.onLoaded.call(self);
          }

          self.initModal();

          callback.call(self);
        }, 'html');
      };

    } else {
      self.el = el;
      self.initModal();
    }

  },

  initModal: function() {
    var self = this;

    // use modalTemplate to create new modal element
    self.el = self.options.modalTemplate.apply(self, [ self.el ]).hide();

    // append element to body
    if (self.el.parents('body').size() === 0) {
      self.el.appendTo('body');
    }

    // initialize modal but dont show it
    self.el.modal({
      backdrop: 'static',
      dynamic: true,
      keyboard: false,
      show: false
    });

    // disable all clicks on modal
    self.el.on('click', function(e) {
      var target = $(e.target);

      e.stopPropagation();

      // we prevent all clicks inside overlay except:
      //  - ones who we explicitly mark with allowDefault class
      //  - file and checkbox input elements
      if (!target.hasClass("allowDefault") &&
          target.attr('type') !== 'file' &&
          target.attr('type') !== 'radio' &&
          target.attr('type') !== 'checkbox') {

        e.preventDefault();

        if (self._formButtons) {

          // check if any form button was clicked
          var clickedButton;
          $.each(self._formButtons, function(formButton) {
            var el = $(formButton, self.el);
            if (el.size() !== 0 && el[0] === e.target) {
              clickedButton = formButton;
            }
          });

          if (clickedButton) {
            var form = $(clickedButton, self.el).parents('form');
            if (form.size() !== 0) {
              var data = {};
              data[$(e.target).attr('name')] = $(e.target).attr('value');
              form.ajaxSubmit($.extend(true,
                    self._formButtons[clickedButton], { data: data } ));
            }
          }


        }

      }
    });

    // jquery.form integration: at this point we calculate form options which
    // are passed when button will be clicked
    if (self.options.formButtons) {
      self._formButtons = {};
      $.each(self.options.formButtons, function(formButton) {
        var button = $(formButton, self.el);
        if (button.size() !== 0) {
          self._formButtons[formButton] = self.options.formButtons[formButton]
              .apply(self, [ button ]);
        }
      });
    }

    // $.iframe integration:
    //  - calls stretch/shrink when showing/hidding of modal
    //  - sync scrolling of top frame and current frame
    if ($.iframe !== undefined) {

      var topFrameHeight = $($.iframe.document).height();
      self.el
        .on('show', function() {
          $.iframe.stretch();
          // TODO: probably we should move this in $.iframe
          //$('.dropdown-toggle.open a[data-toggle="dropdown"]').dropdown('toggle');
        })
        .on('shown', function() {
          if (self.el.parents('.modal-wrapper').height() > topFrameHeight) {
            $('body', $.iframe.document).height(
                self.el.parents('.modal-wrapper').height() +
                self.el.parents('.modal-wrapper').offset().top);
            self.el.parents('.modal-backdrop').height($($.iframe.window).height());
          }
        })
        .on('hidden', function() {
          $('body', $.iframe.document).height(topFrameHeight);
          $.iframe.shrink();
        });

      // sync scrolling
      $($.iframe.document).scroll(function () {
        var backdrop = self.el.parents('.modal-backdrop');

        if ($.iframe && $.iframe.document) {
          backdrop.css({
            'top': -1 * $($.iframe.document).scrollTop(),
            'height': $($.iframe.document).scrollTop() + backdrop.height()
          });
        }

        // TODO: is this really needed
        //self.el.modal('show');  // this will make sure backdrop is fully sized
      });
    }

    // plone.init.js integration
    if ($.fn.ploneInit) {
      self.el.ploneInit();
    }

    // initialize hook
    if (self.options.onInit) {
      self.options.onInit.call(self);
    }
  },

  show: function() {
    var self = this;

    // if self.el is function then call it and pass this function as parameter
    // which needs to be called once loading of modal's html has been done
    if (typeof(self.el) === 'function') {
      self.el.apply(self, [ self.show ]);

    } else {

      // showing bootstrap's modal
      self.el.modal('show');

      // show hook
      if (self.options.onShow) {
        self.options.onShow.call(self);
      }
    }
  },

  hide: function() {
    var self = this;

    // hiding of modal is not possible if its not even loaded
    if (typeof(self.el) === 'function') {
      return;
    }

    // calling hide on bootstrap's modal
    self.el.modal('hide');

    // hide hook
    if (self.options.onHide) {
      self.options.onHide.call(self);
    }
  },

  destroy: function() {
    var self = this;

    // destroying of modal is not possible if its not even created
    if (typeof(self.el) === 'function') {
      return;
    }

    // first we hide modal, so all nice animations happen.
    self.hide();

    // remove modal's DOM element
    self.el.remove();

    //  reinitialize
    if (self._el) {
      self._el.data('plone-overlay', new PloneOverlay(self._el, self.options));
    }

    // destroy hook
    if (self.options.onDestroy) {
      self.options.onDestroy.call(self);
    }
  },

  getBaseURL: function(text){
    return $((/<base[^>]*>((.|[\n\r])*)<\/base>/im).exec(text)[0]).attr('href');
  }

};


// jQuery Integration
$.fn.ploneOverlay = function (options) {
  return this.each(function() {
    var el =  $(this),
        data = $(this).data('plone-overlay');

    options = options || {};

    // create new instance of overlay if not yet created
    if (!data) {
      $(this).data('plone-overlay', (data = new PloneOverlay(el, options)));
    }

    // expose only certain function as public API
    if (typeof options === 'string') {
      if (['show', 'hide', 'destroy'].indexOf(options) !== -1) {
        data[options]();
      }
    } else if (options.show) {
      data.show();
    }
  });
};

$.fn.ploneOverlay.defaultAjaxSubmit = function(defaultOptions) {

  defaultOptions = $.extend({
    errorMsg: '.portalMessage.error',
    buttonContainer: '.modal-footer',
    responseFilter: '#content',

    // hooks
    onError: undefined,
    onSave: undefined

  } , defaultOptions || {});

  return function(button, options) {
    var overlay = this;

    // make this method extendable
    options = $.extend({}, defaultOptions, options || {});

    // hide and copy same button to .modal-footer, clicking on button in
    // footer should actually click on button inside form
    button.clone()
      .appendTo($(options.buttonContainer, overlay.el))
      .on('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        button.trigger('click');
      });
    button.hide();

    // we return array of options which will be passed to ajaxSubmit
    // TODO: add loading spinner
    // TODO: hook in notification stuff
    return {
      dataType: 'html',
      beforeSerialize: function(form, options) {

        // save tinymce text to textarea
        var textarea = $('.mce_editable', form),
            textareaId = textarea.attr('id');
        if (textarea.size() !== 0 && tinyMCE &&
            tinyMCE.editors[textareaId] !== undefined) {
          tinyMCE.editors[textareaId].save();
          tinyMCE.editors[textareaId].remove();
        }

      },
      success: function(response, state, xhr, form) {
        var _document = document,
            responseBody = $('<div/>').html(
                (/<body[^>]*>((.|[\n\r])*)<\/body>/im).exec(response)[1]);

        // use $.iframe's if avaliable
        if ($.iframe) {
          _document = $.iframe.document;
        }

        // if error is found res
        if ($(options.errorMsg, responseBody).size() !== 0) {
          // TODO: this should be done more smooth
          overlay.el.remove();
          overlay.el = $(options.responseFilter, responseBody);
          overlay.initModal();

          if (options.onError) {
            options.onError.apply(overlay, [ responseBody, state, xhr, form, button ]);
          }

          overlay.show();

        // custom save function
        } else if (options.onSave) {
          options.onSave.apply(overlay, [ responseBody, state, xhr, form, button ]);

        // common save function, we replace what we filtered from response
        } else if ($(options.responseFilter, _document).size() !== 0) {
          $(options.responseFilter, _document)
            .html($(options.responseFilter, responseBody).html());
          overlay.destroy();

        } else {
          overlay.destroy();
        }
      }
    };
  };
};

$.fn.ploneOverlay.defaultModalTemplate = function(options) {

  options = $.extend({
    title: 'h1.documentFirstHeading',
    body: '#content',
    destroy: '[data-dismiss="modal"]'
  } , options || {});

  return function(content) {
    var overlay = this,
        el = $('' +
          '<div class="modal fade">' +
          '  <div class="modal-header">' +
          '    <a class="close" data-dismiss="modal">&times;</a>' +
          '    <h3></h3>' +
          '  </div>' +
          '  <div class="modal-body"></div>' +
          '  <div class="modal-footer"></div>' +
          '</div>'),
        title = $('.modal-header > h3', el),
        body = $('.modal-body', el),
        footer = $('.modal-footer', el);


    // Title
    title.html($(options.title, content).html());

    // Content
    body.html($(options.body, content).html());
    $(options.title, body).remove();
    $(options.footer, body).remove();

    // destroying modal
    $(options.destroy, el).off('click').on('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      overlay.destroy();
    });

    return el;
  };
};

$.fn.ploneOverlay.defaults = {
  mask: $.mask || undefined,

  // hooks
  onInit: undefined,
  onBeforeLoad: undefined,
  onLoaded: undefined,
  onShow: undefined,
  onHide: undefined,
  onDestroy: undefined,

  // buttons which should
  formButtons: {},

  // template for overlay
  modalTemplate: $.fn.ploneOverlay.defaultModalTemplate(),

  // adding prefix to url (after domain part)
  changeAjaxURL: function(url, prefix) {
    prefix = prefix || '++unthemed++';

    // TODO: we should add it after plone site url (head>base)
    if (url.indexOf('http') === 0) {
      return url.replace(/^(https?:\/\/[^\/]+)\/(.*)/, '$1/' + prefix + '/$2');
    } else if (url.indexOf('/') === 0) {
      return window.location.protocol + '//' +
              window.location.host + '/' + prefix + url;
    } else {
      return window.location.protocol + '//' +
              window.location.host + '/' + prefix +
              window.location.pathname + '/' + url;
    }
  }

};

$.fn.ploneOverlay.Constructor = PloneOverlay;


}(window.jQuery));
