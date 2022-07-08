/**
   GeoShift (C) 2018 Beholder Corporation / FoxyProxy
 * support@getfoxyproxy.org
 *
 * This source code is proprietary, and released under the EULA available in the
 * LICENSE file at the root of this installation. Do not copy or re-use without
 * written permission.
 */

function act(options) {
  if (!options) return;
  var spinnerSelector = options.spinnerSelector || '',
		btnSelector = options.btnSelector || '',
    successCallbackAndParams = options.successCallbackAndParams,
		errorCallbackAndParams = options.errorCallbackAndParams,
    params = options.params;

  $(spinnerSelector).html('<i class="fa fa-refresh fa-spin fa-3x fp-orange"></i>');
  $(btnSelector).prop('disabled', true);
  $.ajax({
    dataType: "json",
    type: options.type || "GET",
    url: options.url,
    data: params,
    success: function(json) {
			$(btnSelector).prop('disabled', false);
			$(spinnerSelector).html('');
			if (Object.keys(json).length === 0) {
      	if (errorCallbackAndParams) {
					errorCallbackAndParams.callback(json, errorCallbackAndParams.params);
        }
			}
      else if (successCallbackAndParams) {
        successCallbackAndParams.callback(json, successCallbackAndParams.params);
      }
    },
    error: function(b,c,d) {
			$(btnSelector).prop('disabled', false);
      $(spinnerSelector).html('');
      if (errorCallbackAndParams) {
      	errorCallbackAndParams.callback(null, errorCallbackAndParams.params);
      }
    }
  });
}
