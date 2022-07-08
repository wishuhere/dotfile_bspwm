$(document).ready(function(){
        $('[data-accordion-trigger]').on('click', function() {
                if ($(event.currentTarget).is('[data-accordion]')) {
                        var curr_acc = $(event.currentTarget);
                } else {
                        var curr_acc = $(event.currentTarget).parents('[data-accordion]');
                }
                if (curr_acc.hasClass('open')) {
                        curr_acc.removeClass('open').addClass('close');
                } else {
                        var acc_group = curr_acc.parents('[data-accordion-group]');
                        if (acc_group) {
                                acc_group.find('[data-accordion]').removeClass('open').addClass('close');
                        }
                        curr_acc.removeClass('close').addClass('open');
                }
        });
});
