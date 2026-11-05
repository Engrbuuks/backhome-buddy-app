<?php
/**
 * Header.
 *
 * `bhb-dark` is set by the front page so the header sits on the dark hero
 * without a seam. Everywhere else it is the light header on white.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$bhb_dark = ! empty( $GLOBALS['bhb_dark_header'] );
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<?php wp_head(); ?>
</head>
<body <?php body_class( $bhb_dark ? 'bhb-has-dark-header' : '' ); ?>>
<?php wp_body_open(); ?>

<a class="bhb-skip" href="#bhb-main">Skip to content</a>

<header class="bhb-header <?php echo $bhb_dark ? 'bhb-header--dark' : ''; ?>">
	<div class="bhb-header__inner">
		<a class="bhb-logo" href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">
			<?php
			if ( has_custom_logo() ) {
				the_custom_logo();
			} else {
				echo '<span class="bhb-logo__text">' . esc_html( get_bloginfo( 'name' ) ) . '</span>';
			}
			?>
		</a>

		<nav class="bhb-nav" aria-label="<?php esc_attr_e( 'Primary', 'bhb-marketing' ); ?>">
			<?php
			if ( has_nav_menu( 'primary' ) ) {
				wp_nav_menu( array(
					'theme_location' => 'primary',
					'container'      => false,
					'menu_class'     => 'bhb-nav__list',
					'depth'          => 1,
					'fallback_cb'    => false,
				) );
			}
			?>
		</nav>

		<div class="bhb-header__cta">
			<a class="bhb-link-quiet" href="<?php echo bhb_app_link( '/login' ); ?>">Sign in</a>
			<a class="bhb-btn bhb-btn--primary" href="<?php echo bhb_app_link( '/signup' ); ?>">Start a task</a>
		</div>
	</div>
</header>

<main id="bhb-main">
