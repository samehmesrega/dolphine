<?php
/**
 * Plugin Name: Dolphine
 * Description: اربط فورم معيّنة بتطبيق Dolphine. اختر الفورم ورابط الويب هوك من التطبيق — فقط هذه الفورم ستُرسل كليدز.
 * Version: 1.2.0
 * Author: Dolphine
 * Text Domain: dolphine
 */

if (!defined('ABSPATH')) {
    exit;
}

define('DOLPHINE_CONNECTIONS_OPTION', 'dolphine_form_connections');

// إعدادات في لوحة التحكم
add_action('admin_menu', function () {
    add_options_page(
        'Dolphine - ربط فورم معيّنة',
        'Dolphine',
        'manage_options',
        'dolphine',
        'dolphine_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('dolphine_settings', DOLPHINE_CONNECTIONS_OPTION, [
        'type'              => 'array',
        'sanitize_callback' => 'dolphine_sanitize_connections',
    ]);
});

function dolphine_sanitize_connections($input) {
    if (!is_array($input)) {
        return [];
    }
    $out = [];
    foreach ($input as $row) {
        if (empty($row['webhook_url']) || strpos($row['webhook_url'], '/api/webhooks/leads/') === false) {
            continue;
        }
        $out[] = [
            'form_type'   => in_array($row['form_type'] ?? '', ['cf7', 'elementor', 'forminator'], true) ? $row['form_type'] : 'cf7',
            'form_id'     => isset($row['form_id']) ? sanitize_text_field($row['form_id']) : '',
            'webhook_url' => esc_url_raw($row['webhook_url']),
            'label'       => isset($row['label']) ? sanitize_text_field($row['label']) : '',
        ];
    }
    return $out;
}

add_action('admin_post_dolphine_add_connection', function () {
    if (!current_user_can('manage_options') || empty($_POST['_wpnonce']) || !wp_verify_nonce($_POST['_wpnonce'], 'dolphine_add')) {
        wp_die(__('غير مصرح', 'dolphine'));
    }
    $form_type = isset($_POST['form_type']) ? sanitize_text_field($_POST['form_type']) : 'cf7';
    if (!in_array($form_type, ['cf7', 'elementor', 'forminator'], true)) {
        $form_type = 'cf7';
    }
    $form_id = isset($_POST['form_id']) ? sanitize_text_field($_POST['form_id']) : '';
    if ($form_type === 'elementor' && !empty($_POST['form_id_elementor'])) {
        $form_id = sanitize_text_field($_POST['form_id_elementor']);
    }
    if ($form_type === 'forminator' && !empty($_POST['form_id_forminator'])) {
        $form_id = sanitize_text_field($_POST['form_id_forminator']);
    }
    $webhook_url = isset($_POST['webhook_url']) ? esc_url_raw($_POST['webhook_url']) : '';
    if (empty($webhook_url) || strpos($webhook_url, '/api/webhooks/leads/') === false) {
        wp_redirect(admin_url('options-general.php?page=dolphine&error=url'));
        exit;
    }
    $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
    $connections[] = [
        'form_type'   => $form_type,
        'form_id'     => $form_id,
        'webhook_url' => $webhook_url,
        'label'       => isset($_POST['label']) ? sanitize_text_field($_POST['label']) : '',
    ];
    update_option(DOLPHINE_CONNECTIONS_OPTION, $connections);
    wp_redirect(admin_url('options-general.php?page=dolphine&added=1'));
    exit;
});

add_action('admin_post_dolphine_delete_connection', function () {
    if (!current_user_can('manage_options') || empty($_GET['_wpnonce']) || !wp_verify_nonce($_GET['_wpnonce'], 'dolphine_delete_' . (int) $_GET['index'])) {
        wp_die(__('غير مصرح', 'dolphine'));
    }
    $index = (int) $_GET['index'];
    $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
    if (isset($connections[$index])) {
        array_splice($connections, $index, 1);
        update_option(DOLPHINE_CONNECTIONS_OPTION, $connections);
    }
    wp_redirect(admin_url('options-general.php?page=dolphine&deleted=1'));
    exit;
});

function dolphine_get_cf7_forms() {
    if (!class_exists('WPCF7_ContactForm')) {
        return [];
    }
    $posts = get_posts([
        'post_type'      => 'wpcf7_contact_form',
        'numberposts'    => -1,
        'orderby'       => 'title',
        'order'         => 'ASC',
        'post_status'   => 'any',
    ]);
    $list = [];
    foreach ($posts as $p) {
        $list[] = ['id' => (string) $p->ID, 'title' => $p->post_title ?: __('(بدون عنوان)', 'dolphine')];
    }
    return $list;
}

function dolphine_get_forminator_forms() {
    $list = [];
    if (class_exists('Forminator_API')) {
        if (method_exists('Forminator_API', 'initialize')) {
            Forminator_API::initialize();
        }
        if (method_exists('Forminator_API', 'get_forms')) {
            $forms = Forminator_API::get_forms('form', 1, 200);
            if (!empty($forms) && is_array($forms)) {
                foreach ($forms as $f) {
                    $id = isset($f['id']) ? (string) $f['id'] : (isset($f['form_id']) ? (string) $f['form_id'] : '');
                    $title = isset($f['name']) ? $f['name'] : (isset($f['settings']['formName']) ? $f['settings']['formName'] : __('(بدون عنوان)', 'dolphine'));
                    if ($id !== '') {
                        $list[] = ['id' => $id, 'title' => $title];
                    }
                }
            }
        }
    }
    if (empty($list)) {
        $posts = get_posts([
            'post_type'      => 'forminator_forms',
            'numberposts'    => -1,
            'orderby'       => 'title',
            'order'         => 'ASC',
            'post_status'   => 'any',
        ]);
        foreach ($posts as $p) {
            $list[] = ['id' => (string) $p->ID, 'title' => $p->post_title ?: __('(بدون عنوان)', 'dolphine')];
        }
    }
    return $list;
}

function dolphine_settings_page() {
    $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
    $cf7_forms = dolphine_get_cf7_forms();
    $forminator_forms = dolphine_get_forminator_forms();

    if (!empty($_GET['added'])) {
        echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__('تمت إضافة الربط.', 'dolphine') . '</p></div>';
    }
    if (!empty($_GET['deleted'])) {
        echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__('تم حذف الربط.', 'dolphine') . '</p></div>';
    }
    ?>
    <div class="wrap">
        <h1>ربط فورم معيّنة بتطبيق Dolphine</h1>
        <p>اختر <strong>فورم واحدة</strong> واربطها برابط ويب هوك من التطبيق. فقط هذه الفورم ستُرسل الليدز — باقي الفورمس لا تتأثر.</p>

        <h2 class="title">الربطات الحالية</h2>
        <?php if (empty($connections)) : ?>
            <p class="description">لا توجد ربطات. أضف ربطاً أدناه.</p>
        <?php else : ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>الفورم</th>
                        <th>التسمية</th>
                        <th>رابط الويب هوك</th>
                        <th style="width:80px">إجراء</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($connections as $i => $c) :
                        $form_label = $c['label'] ?: $c['form_id'];
                        if ($c['form_type'] === 'cf7' && !empty($cf7_forms)) {
                            foreach ($cf7_forms as $f) {
                                if ($f['id'] === $c['form_id']) {
                                    $form_label = $f['title'] . ' (ID: ' . $c['form_id'] . ')';
                                    break;
                                }
                            }
                        } elseif ($c['form_type'] === 'forminator' && !empty($forminator_forms)) {
                            foreach ($forminator_forms as $f) {
                                if ($f['id'] === $c['form_id']) {
                                    $form_label = $f['title'] . ' (ID: ' . $c['form_id'] . ')';
                                    break;
                                }
                            }
                        }
                        if (empty($form_label)) {
                            $form_label = ($c['form_id'] ?: '—') . ($c['label'] ? ' — ' . $c['label'] : '');
                        }
                    ?>
                        <tr>
                            <td><?php echo esc_html($c['form_type'] === 'cf7' ? 'Contact Form 7' : ($c['form_type'] === 'forminator' ? 'Forminator' : 'Elementor')); ?></td>
                            <td><?php echo esc_html($form_label); ?></td>
                            <td><code style="font-size:11px"><?php echo esc_html($c['webhook_url']); ?></code></td>
                            <td>
                                <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=dolphine_delete_connection&index=' . $i), 'dolphine_delete_' . $i)); ?>" class="button button-small" onclick="return confirm('حذف هذا الربط؟');">حذف</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <hr>
        <h2 class="title">إضافة ربط فورم جديدة</h2>
        <p class="description">من تطبيق Dolphine: الربط → نماذج ووردبريس → إضافة اتصال → انسخ رابط الويب هوك. ثم اختر الفورم أدناه والصق الرابط.</p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="dolphine_add_connection" />
            <?php wp_nonce_field('dolphine_add'); ?>
            <table class="form-table">
                <tr>
                    <th><label for="dolphine_form_type">نوع الفورم</label></th>
                    <td>
                        <select name="form_type" id="dolphine_form_type">
                            <option value="cf7">Contact Form 7</option>
                            <option value="forminator">Forminator</option>
                            <option value="elementor">Elementor Form</option>
                        </select>
                    </td>
                </tr>
                <tr class="dolphine-cf7-row">
                    <th><label for="dolphine_form_id">الفورم (CF7)</label></th>
                    <td>
                        <?php if (empty($cf7_forms)) : ?>
                            <p class="description">لا توجد نماذج Contact Form 7. أنشئ نموذجاً أولاً.</p>
                        <?php else : ?>
                            <select name="form_id" id="dolphine_form_id">
                                <option value="">— اختر النموذج —</option>
                                <?php foreach ($cf7_forms as $f) : ?>
                                    <option value="<?php echo esc_attr($f['id']); ?>"><?php echo esc_html($f['title']); ?> (ID: <?php echo esc_html($f['id']); ?>)</option>
                                <?php endforeach; ?>
                            </select>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr class="dolphine-forminator-row" style="display:none">
                    <th><label for="dolphine_form_id_fm">الفورم (Forminator)</label></th>
                    <td>
                        <?php if (empty($forminator_forms)) : ?>
                            <input type="text" name="form_id_forminator" id="dolphine_form_id_fm" class="regular-text" placeholder="معرّف الفورم (رقم)" />
                            <p class="description">ادخل معرّف الفورم (رقم) من Forminator → النماذج → انقر الفورم واختر الإعدادات، أو من الرابط.</p>
                        <?php else : ?>
                            <select name="form_id_forminator" id="dolphine_form_id_fm">
                                <option value="">— اختر النموذج —</option>
                                <?php foreach ($forminator_forms as $f) : ?>
                                    <option value="<?php echo esc_attr($f['id']); ?>"><?php echo esc_html($f['title']); ?> (ID: <?php echo esc_html($f['id']); ?>)</option>
                                <?php endforeach; ?>
                            </select>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr class="dolphine-elementor-row" style="display:none">
                    <th><label for="dolphine_form_id_el">معرّف أو اسم فورم Elementor</label></th>
                    <td>
                        <input type="text" name="form_id_elementor" id="dolphine_form_id_el" class="regular-text" placeholder="مثلاً: نموذج اتصل بنا" />
                        <p class="description">اسم الفورم كما في إعدادات Elementor (Form Name).</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="dolphine_webhook_url">رابط الويب هوك</label></th>
                    <td>
                        <input type="url" name="webhook_url" id="dolphine_webhook_url" class="large-text" placeholder="https://your-api.com/api/webhooks/leads/xxxxx" required />
                    </td>
                </tr>
                <tr>
                    <th><label for="dolphine_label">تسمية (اختياري)</label></th>
                    <td>
                        <input type="text" name="label" id="dolphine_label" class="regular-text" placeholder="مثلاً: نموذج اتصل بنا" />
                    </td>
                </tr>
            </table>
            <p class="submit">
                <button type="submit" class="button button-primary">إضافة الربط</button>
            </p>
        </form>
        <script>
        document.getElementById('dolphine_form_type').addEventListener('change', function() {
            var v = this.value;
            document.querySelector('.dolphine-cf7-row').style.display = v === 'cf7' ? '' : 'none';
            document.querySelector('.dolphine-forminator-row').style.display = v === 'forminator' ? '' : 'none';
            document.querySelector('.dolphine-elementor-row').style.display = v === 'elementor' ? '' : 'none';
            var fid = document.querySelector('#dolphine_form_id');
            if (fid) fid.required = (v === 'cf7');
        });
        document.getElementById('dolphine_form_type').dispatchEvent(new Event('change'));
        </script>
    </div>
    <?php
}

/**
 * إرسال إلى رابط معيّن (فورم معيّنة فقط)
 */
function dolphine_send_to_url($webhook_url, $payload) {
    if (empty($webhook_url) || strpos($webhook_url, '/api/webhooks/leads/') === false) {
        return;
    }
    wp_remote_post($webhook_url, [
        'timeout'  => 15,
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode($payload),
        'blocking' => false,
    ]);
}

/**
 * الحصول على رابط الويب هوك المربوط بفورم معيّنة (CF7)
 */
function dolphine_get_webhook_for_cf7_form($form_id) {
    $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
    foreach ($connections as $c) {
        if ($c['form_type'] === 'cf7' && (string) $c['form_id'] === (string) $form_id) {
            return $c['webhook_url'];
        }
    }
    return null;
}

/**
 * الحصول على رابط الويب هوك المربوط بفورم Elementor (بـ form_id أو name)
 */
function dolphine_get_webhook_for_elementor_form($form_id_or_name) {
    $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
    foreach ($connections as $c) {
        if ($c['form_type'] === 'elementor' && (string) $c['form_id'] === (string) $form_id_or_name) {
            return $c['webhook_url'];
        }
    }
    return null;
}

/**
 * الحصول على رابط الويب هوك المربوط بفورم Forminator
 */
function dolphine_get_webhook_for_forminator_form($form_id) {
    $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
    foreach ($connections as $c) {
        if ($c['form_type'] === 'forminator' && (string) $c['form_id'] === (string) $form_id) {
            return $c['webhook_url'];
        }
    }
    return null;
}

/**
 * تحويل إدخال Forminator إلى مصفوفة بسيطة مع أسماء حقول متوافقة (your-name, your-phone, your-email)
 */
function dolphine_forminator_entry_to_payload($entry) {
    $payload = [];
    if (empty($entry->meta_data) || !is_array($entry->meta_data)) {
        return $payload;
    }
    $name_val = '';
    $phone_val = '';
    $email_val = '';
    foreach ($entry->meta_data as $key => $arr) {
        $val = '';
        if (is_scalar($arr)) {
            $val = (string) $arr;
        } elseif (isset($arr['value'])) {
            $val = is_array($arr['value']) ? (isset($arr['value'][0]) ? (string) $arr['value'][0] : '') : (string) $arr['value'];
        } elseif (is_array($arr) && isset($arr[0])) {
            $val = is_string($arr[0]) ? $arr[0] : (isset($arr[0]['value']) ? (string) $arr[0]['value'] : '');
        }
        $payload[$key] = $val;
        $k = strtolower($key);
        if ($name_val === '' && (strpos($k, 'name') !== false || strpos($k, 'text') !== false)) {
            $name_val = $val;
        }
        if ($phone_val === '' && (strpos($k, 'phone') !== false || strpos($k, 'tel') !== false)) {
            $phone_val = $val;
        }
        if ($email_val === '' && strpos($k, 'email') !== false) {
            $email_val = $val;
        }
    }
    if ($name_val !== '') {
        $payload['your-name'] = $name_val;
        $payload['name'] = $name_val;
    }
    if ($phone_val !== '') {
        $payload['your-phone'] = $phone_val;
        $payload['phone'] = $phone_val;
    }
    if ($email_val !== '') {
        $payload['your-email'] = $email_val;
        $payload['email'] = $email_val;
    }
    return $payload;
}

// Contact Form 7: إرسال فقط إذا كانت هذه الفورم مربوطة
add_action('wpcf7_submit', function ($contact_form, $result) {
    if ($result['status'] !== 'mail_sent' && $result['status'] !== 'mail_failed') {
        return;
    }
    $form_id = $contact_form->id();
    $url = dolphine_get_webhook_for_cf7_form($form_id);
    if (!$url) {
        return; // هذه الفورم غير مربوطة — لا نرسل
    }
    $submission = \WPCF7_Submission::get_instance();
    if (!$submission) {
        return;
    }
    $posted = $submission->get_posted_data();
    if (!empty($posted)) {
        dolphine_send_to_url($url, $posted);
    }
}, 20, 2);

// Elementor Forms: إرسال فقط إذا كانت هذه الفورم مربوطة (form_id = form name أو id من الإعدادات)
add_action('elementor_pro/forms/new_record', function ($record, $handler) {
    $form_name = $record->get_form_settings('form_name');
    $url = dolphine_get_webhook_for_elementor_form($form_name ?: $record->get_id());
    if (!$url) {
        return;
    }
    $sent_data = $record->get('sent_data');
    if (!empty($sent_data) && is_array($sent_data)) {
        dolphine_send_to_url($url, $sent_data);
    }
}, 10, 2);

// Forminator: إرسال فقط إذا كانت هذه الفورم مربوطة (بعد الإرسال العادي و Ajax)
function dolphine_on_forminator_submit($form_id, $response_or_entry_id) {
    if (is_array($response_or_entry_id) && empty($response_or_entry_id['success'])) {
        return;
    }
    $url = dolphine_get_webhook_for_forminator_form($form_id);
    if (!$url) {
        return;
    }
    if (!class_exists('Forminator_Form_Entry_Model')) {
        return;
    }
    $entry = Forminator_Form_Entry_Model::get_latest_entry_by_form_id($form_id);
    if (!$entry) {
        return;
    }
    $payload = dolphine_forminator_entry_to_payload($entry);
    if (!empty($payload)) {
        dolphine_send_to_url($url, $payload);
    }
}
add_action('forminator_form_after_handle_submit', 'dolphine_on_forminator_submit', 10, 2);
add_action('forminator_form_after_save_entry', 'dolphine_on_forminator_submit', 10, 2);

// للاستخدام من كود: إرسال يدوي لرابط معيّن
add_action('dolphine_form_submitted', function ($payload, $webhook_url = null) {
    if ($webhook_url && is_array($payload)) {
        dolphine_send_to_url($webhook_url, $payload);
    }
}, 10, 2);
add_action('dolphin_leads_form_submitted', function ($payload) {
    if (is_array($payload)) {
        $connections = get_option(DOLPHINE_CONNECTIONS_OPTION, []);
        $first = $connections[0]['webhook_url'] ?? null;
        if ($first) {
            dolphine_send_to_url($first, $payload);
        }
    }
}, 10, 1);
