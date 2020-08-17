"""Review classes for editing np arrays"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import io
import copy
import json
import os
import sys
import tarfile
import tempfile

import boto3
import matplotlib.pyplot as plt
import numpy as np
from skimage import filters
from skimage.morphology import flood_fill, flood
from skimage.morphology import watershed, dilation, disk
from skimage.draw import circle
from skimage.measure import regionprops
from skimage.exposure import rescale_intensity
from skimage.segmentation import find_boundaries

from imgutils import pngify
from helpers import is_npz_file, is_trk_file
from config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

class BaseFile(object): # pylint: disable=useless-object-inheritance
    """Base class for the files viewed in Caliban."""
    
    def __init__(self, filename, bucket, path, raw_key, annotated_key):
        self.filename = filename
        self.bucket = bucket
        self.path = path

        self.raw_key = raw_key
        self.annotated_key = annotated_key

        self.trial = self.load()
        self.raw = self.trial[raw_key]
        self.annotated = self.trial[annotated_key]

        self.channel_max = self.raw.shape[-1]
        self.feature_max = self.annotated.shape[-1]
        # TODO: is there a potential IndexError here?
        self.max_frames = self.raw.shape[0]
        self.height = self.raw.shape[1]
        self.width = self.raw.shape[2]

    def _get_s3_client(self):
        return boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )

    def load(self):
        """Load a file from the S3 input bucket"""    
        if is_npz_file(self.filename):
            _load = load_npz
        elif is_trk_file(self.filename):
            _load = load_trks
        else:
            raise ValueError('Cannot load file: {}'.format(self.filename))

        s3 = self._get_s3_client()
        response = s3.get_object(Bucket=self.bucket, Key=self.path)
        return _load(response['Body'].read())


class ZStackFile(BaseFile):
    """
    Class for .npz files for Z-stack images.
    """

    def __init__(self, filename, bucket, path,
                 raw_key='raw', annotated_key='annotated', rgb=False):
        super(ZStackFile, self).__init__(filename, bucket, path, raw_key, annotated_key)

        # create a dictionary that has frame information about each cell
        # analogous to .trk lineage but do not need relationships between cells included
        self.cell_ids = {}
        self.cell_info = {}

    
class TrackFile(BaseFile):
    """
    Class for .trk files for cell tracking.
    """

    def __init__(self, filename, bucket, path,
                 raw_key='raw', annotated_key='tracked'):
        super(TrackFile, self).__init__(filename, bucket, path, raw_key, annotated_key)

        # lineages is a list of dictionaries. There should be only a single one
        # when using a .trk file
        if len(self.trial['lineages']) != 1:
            raise ValueError('Input file has multiple trials/lineages.')

        self.tracks = self.trial['lineages'][0]


class BaseView(object): # pylint: disable=useless-object-inheritance
    """
    Base class for viewing a file in Caliban.
    Implements everything but actions on the file.
    """

    def __init__(self, file_):
        self.file = file_

        self.current_frame = 0
        self.scale_factor = 1

        self.color_map = plt.get_cmap('viridis')
        self.color_map.set_bad('black')

        self.feature = 0
        self.channel = 0

        self.max_intensity = {}
        for channel in range(self.file.channel_max):
            self.max_intensity[channel] = None

    def rescale_95(self, img):
        """Rescale a single- or multi-channel image."""
        percentiles = np.percentile(img[img > 0], [5, 95])
        rescaled_img = rescale_intensity(
            img,
            in_range=(percentiles[0], percentiles[1]),
            out_range='uint8')
        rescaled_img = rescaled_img.astype('uint8')
        return rescaled_img

    def add_outlines(self, frame):
        """Indicate label outlines in array with negative values of that label.
        """
        # this is sometimes int 32 but may be uint, convert to
        # int16 to ensure negative numbers and smaller payload than int32
        frame = frame.astype(np.int16)
        boundary_mask = find_boundaries(frame, mode='inner')
        outlined_frame = np.where(boundary_mask == 1, -frame, frame)
        return outlined_frame

    def get_array(self, frame, add_outlines=True):
        frame = self.file.annotated[frame, ..., self.feature]
        if add_outlines:
            frame = self.add_outlines(frame)
        return frame

    def get_frame(self, frame, raw):
        self.current_frame = frame
        if raw:
            frame = self.file.raw[frame, ..., self.channel]
            return pngify(imgarr=frame,
                          vmin=0,
                          vmax=self.max_intensity[self.channel],
                          cmap='cubehelix')
        else:
            frame = self.file.annotated[frame, ..., self.feature]
            frame = np.ma.masked_equal(frame, 0)
            return pngify(imgarr=frame,
                          vmin=0,
                          vmax=self.get_max_label(),
                          cmap=self.color_map)

    def get_max_label(self):
        raise NotImplementedError('get_max_label is not implemented in BaseView')


class ZStackView(BaseView):
    
    def __init__(self, file_, rgb=False):
        super(ZStackView, self).__init__(file_)

        self.rgb = rgb

        if self.rgb:
            # possible differences between single channel and rgb displays
            if self.file.raw.ndim == 3:
                self.file.raw = np.expand_dims(self.file.raw, axis=0)
                self.file.annotated = np.expand_dims(self.file.__setattr__annotated, axis=0)

                # reassigning height/width for new shape.
                self.file.max_frames = self.file.raw.shape[0]
                self.file.height = self.file.raw.shape[1]
                self.file.width = self.file.raw.shape[2]

            self.rgb_img = self.reduce_to_RGB()
    
    def get_max_label(self):
        """Get the highest label in use in currently-viewed feature.

        If feature is empty, returns 0 to prevent other functions from crashing.
        """
        # check this first, np.max of empty array will crash
        if len(self.file.cell_ids[self.feature]) == 0:
            max_label = 0
        # if any labels exist in feature, find the max label
        else:
            max_label = int(np.max(self.file.cell_ids[self.feature]))
        return max_label

    def get_frame(self, frame, raw):
        self.current_frame = frame
        if (raw and self.rgb):
            return pngify(imgarr=self.rgb_img,
                          vmin=None,
                          vmax=None,
                          cmap=None)
        return super(ZStackView, self).get_frame(frame, raw)

    def reduce_to_RGB(self):
        '''
        Go from rescaled raw array with up to 6 channels to an RGB image for display.
        Handles adding in CMY channels as needed, and adjusting each channel if
        viewing adjusted raw. Used to update self.rgb, which is used to display
        raw current frame.
        '''
        rescaled = self.rescale_raw()
        # rgb starts as uint16 so it can handle values above 255 without overflow
        rgb_img = np.zeros((self.file.height, self.file.width, 3), dtype='uint16')

        # for each of the channels that we have
        for c in range(min(6, self.file.channel_max)):
            # straightforward RGB -> RGB
            new_channel = (rescaled[..., c]).astype('uint16')
            if c < 3:
                rgb_img[..., c] = new_channel
            # collapse cyan to G and B
            if c == 3:
                rgb_img[..., 1] += new_channel
                rgb_img[..., 2] += new_channel
            # collapse magenta to R and B
            if c == 4:
                rgb_img[..., 0] += new_channel
                rgb_img[..., 2] += new_channel
            # collapse yellow to R and G
            if c == 5:
                rgb_img[..., 0] += new_channel
                rgb_img[..., 1] += new_channel

            # clip values to uint8 range so it can be cast without overflow
            rgb_img[..., 0:3] = np.clip(rgb_img[..., 0:3], a_min=0, a_max=255)

        return rgb_img.astype('uint8')

    def rescale_raw(self):
        """Rescale first 6 raw channels individually and store in memory.

        The rescaled raw array is used subsequently for image display purposes.
        """
        rescaled = np.zeros((self.file.height, self.file.width, self.file.channel_max), 
                            dtype='uint8')
        # this approach allows noise through
        for channel in range(min(6, self.file.channel_max)):
            raw_channel = self.file.raw[self.current_frame, ..., channel]
            if np.sum(raw_channel) != 0:
                rescaled[..., channel] = self.rescale_95(raw_channel)
        return rescaled 


class TrackView(BaseView):
    
    def get_max_label(self):
        """Get the highest label in the lineage data."""
        return max(self.file.tracks)
        
    
# class Feedback():
#     """Class for viewing feedback from quality control."""

#     # TODO: @tddough98 use qc_bucket to show changes from QC
#     def __init__(self, filename, input_bucket, output_bucket, path,
#                  raw_key='raw', annotated_key='annotated'):

#         self.input_file = BaseFile(filename, input_bucket, path, raw_key, annotated_key)
#         self.output_file = BaseFile(filename, output_bucket, path, raw_key, annotated_key)

#         self.input_view = BaseView(self.input_file)
#         self.output_view = BaseView(self.output_file)


class BaseReview(object):
    """Base class for all Review objects."""

    def __init__(self, filename, input_bucket, output_bucket, path,
                 raw_key='raw', annotated_key='annotated'):

        self.file = BaseFile(filename, input_bucket, path, raw_key, annotated_key)
        self.view = BaseView(self.file)
        
        self.output_bucket = output_bucket

        self._x_changed = False
        self._y_changed = False
        self.info_changed = False

    def add_cell_info(self, add_label, frame):
        raise NotImplementedError('add_cell_info is not implemented in BaseReview')

    def del_cell_info(self, del_label, frame):
        raise NotImplementedError('del_cell_info is not implemented in BaseReview')

    def action(self, action_type, info):
        """Call an action method based on an action type."""
        attr_name = 'action_{}'.format(action_type)
        try:
            action = getattr(self, attr_name)
            action(**info)
        except AttributeError:
            raise ValueError('Invalid action "{}"'.format(action_type))

    def action_change_channel(self, channel):
        """Change selected channel."""
        if channel < 0 or channel > self.file.channel_max:
            raise ValueError('Channel {} is outside of range [0, {}].'.format(
                channel, self.file.channel_max))
        self.channel = channel
        self._x_changed = True

    def action_change_feature(self, feature):
        """Change selected feature."""
        if feature < 0 or feature > self.file.feature_max:
            raise ValueError('Feature {} is outside of range [0, {}].'.format(
                feature, self.file.feature_max))
        self.feature = feature
        self._y_changed = True

    def action_new_single_cell(self, label, frame):
        """Create new label in just one frame"""
        new_label = self.view.get_max_label() + 1

        # replace frame labels
        img = self.file.annotated[frame, ..., self.feature]
        img[img == label] = new_label

        # replace fields
        self.del_cell_info(del_label=label, frame=frame)
        self.add_cell_info(add_label=new_label, frame=frame)

    def action_delete_mask(self, label, frame):
        """Deletes label from the frame"""
        # TODO: update the action name?
        ann_img = self.file.annotated[frame, ..., self.feature]
        ann_img = np.where(ann_img == label, 0, ann_img)

        self.file.annotated[frame, ..., self.feature] = ann_img

        # update cell_info
        self.del_cell_info(del_label=label, frame=frame)

    def action_swap_single_frame(self, label_1, label_2, frame):
        """Swap labels of two objects in the frame."""
        ann_img = self.file.annotated[frame, ..., self.feature]
        ann_img = np.where(ann_img == label_1, -1, ann_img)
        ann_img = np.where(ann_img == label_2, label_1, ann_img)
        ann_img = np.where(ann_img == -1, label_2, ann_img)

        self.file.annotated[frame, ..., self.feature] = ann_img

        self._y_changed = self.info_changed = True

    def action_handle_draw(self, trace, target_value, brush_value, brush_size, erase, frame):
        """Use a "brush" to draw in the brush value along trace locations of
        the annotated data.
        """
        annotated = np.copy(self.file.annotated[frame, ..., self.feature])

        in_original = np.any(np.isin(annotated, brush_value))

        annotated_draw = np.where(annotated == target_value, brush_value, annotated)
        annotated_erase = np.where(annotated == brush_value, target_value, annotated)

        for loc in trace:
            # each element of trace is an array with [y,x] coordinates of array
            x_loc = loc[1]
            y_loc = loc[0]

            brush_area = circle(y_loc, x_loc,
                                brush_size // self.view.scale_factor,
                                (self.file.height, self.file.width))

            # do not overwrite or erase labels other than the one you're editing
            if not erase:
                annotated[brush_area] = annotated_draw[brush_area]
            else:
                annotated[brush_area] = annotated_erase[brush_area]

        in_modified = np.any(np.isin(annotated, brush_value))

        # cell deletion
        if in_original and not in_modified:
            self.del_cell_info(del_label=brush_value, frame=frame)

        # cell addition
        elif in_modified and not in_original:
            self.add_cell_info(add_label=brush_value, frame=frame)

        # check for image change, in case pixels changed but no new or del cell
        comparison = np.where(annotated != self.file.annotated[frame, ..., self.feature])
        self._y_changed = np.any(comparison)
        # if info changed, self.info_changed set to true with info helper functions

        self.file.annotated[frame, ..., self.feature] = annotated

    def action_trim_pixels(self, label, frame, x_location, y_location):
        """Remove any pixels with value label that are not connected to the
        selected cell in the given frame.
        """
        img_ann = self.file.annotated[frame, ..., self.feature]

        seed_point = (y_location // self.view.scale_factor,
                      x_location // self.view.scale_factor)

        contig_cell = flood(image=img_ann, seed_point=seed_point)
        stray_pixels = np.logical_and(np.invert(contig_cell), img_ann == label)
        img_trimmed = np.where(stray_pixels, 0, img_ann)

        self._y_changed = np.any(np.where(img_trimmed != img_ann))
        self.file.annotated[frame, ..., self.feature] = img_trimmed

    def action_fill_hole(self, label, frame, x_location, y_location):
        '''
        fill a "hole" in a cell annotation with the cell label. Doesn't check
        if annotation at (y,x) is zero (hole to fill) because that logic is handled in
        javascript. Just takes the click location, scales it to match the actual annotation
        size, then fills the hole with label (using skimage flood_fill). connectivity = 1
        prevents hole fill from spilling out into background in some cases
        '''
        # rescale click location -> corresponding location in annotation array
        hole_fill_seed = (y_location // self.view.scale_factor, x_location // self.view.scale_factor)
        # fill hole with label
        img_ann = self.file.annotated[frame, :, :, self.feature]
        filled_img_ann = flood_fill(img_ann, hole_fill_seed, label, connectivity=1)
        self.file.annotated[frame, :, :, self.feature] = filled_img_ann

        # never changes info but always changes annotation
        self._y_changed = True

    def action_flood_contiguous(self, label, frame, x_location, y_location):
        """Flood fill a cell with a unique new label.

        Alternative to watershed for fixing duplicate labels of
        non-touching objects.
        """
        img_ann = self.file.annotated[frame, ..., self.feature]
        old_label = label
        new_label = self.view.get_max_label() + 1

        in_original = np.any(np.isin(img_ann, old_label))

        filled_img_ann = flood_fill(img_ann,
                                    (int(y_location / self.view.scale_factor),
                                     int(x_location / self.view.scale_factor)),
                                    new_label)
        self.file.annotated[frame, ..., self.feature] = filled_img_ann

        in_modified = np.any(np.isin(filled_img_ann, old_label))

        # update cell info dicts since labels are changing
        self.add_cell_info(add_label=new_label, frame=frame)

        if in_original and not in_modified:
            self.del_cell_info(del_label=old_label, frame=frame)

    def action_watershed(self, label, frame, x1_location, y1_location, x2_location, y2_location):
        """Use watershed to segment different objects"""
        # Pull the label that is being split and find a new valid label
        current_label = label
        new_label = self.view.get_max_label() + 1

        # Locally store the frames to work on
        img_raw = self.file.raw[frame, ..., self.channel]
        img_ann = self.file.annotated[frame, ..., self.feature]

        # Pull the 2 seed locations and store locally
        # define a new seeds labeled img the same size as raw/annotation imgs
        seeds_labeled = np.zeros(img_ann.shape)

        # create two seed locations
        seeds_labeled[int(y1_location / self.view.scale_factor),
                      int(x1_location / self.view.scale_factor)] = current_label

        seeds_labeled[int(y2_location / self.view.scale_factor),
                      int(x2_location / self.view.scale_factor)] = new_label

        # define the bounding box to apply the transform on and select
        # appropriate sections of 3 inputs (raw, seeds, annotation mask)
        props = regionprops(np.squeeze(np.int32(img_ann == current_label)))
        minr, minc, maxr, maxc = props[0].bbox

        # store these subsections to run the watershed on
        img_sub_raw = np.copy(img_raw[minr:maxr, minc:maxc])
        img_sub_ann = np.copy(img_ann[minr:maxr, minc:maxc])
        img_sub_seeds = np.copy(seeds_labeled[minr:maxr, minc:maxc])

        # contrast adjust the raw image to assist the transform
        img_sub_raw_scaled = rescale_intensity(img_sub_raw)

        # apply watershed transform to the subsections
        ws = watershed(-img_sub_raw_scaled, img_sub_seeds,
                       mask=img_sub_ann.astype(bool))

        # did watershed effectively create a new label?
        new_pixels = np.count_nonzero(np.logical_and(
            ws == new_label, img_sub_ann == current_label))

        # if only a few pixels split, dilate them; new label is "brightest"
        # so will expand over other labels and increase area
        if new_pixels < 5:
            ws = dilation(ws, disk(3))

        # ws may only leave a few pixels of old label
        old_pixels = np.count_nonzero(ws == current_label)
        if old_pixels < 5:
            # create dilation image to prevent "dimmer" label from being eroded
            # by the "brighter" label
            dilated_ws = dilation(np.where(ws == current_label, ws, 0), disk(3))
            ws = np.where(dilated_ws == current_label, dilated_ws, ws)

        # only update img_sub_ann where ws has changed label
        # from current_label to new_label
        idx = np.logical_and(ws == new_label, img_sub_ann == current_label)
        img_sub_ann = np.where(idx, ws, img_sub_ann)

        # reintegrate subsection into original mask
        img_ann[minr:maxr, minc:maxc] = img_sub_ann
        self.file.annotated[frame, ..., self.feature] = img_ann

        # update cell_info dict only if new label was created with ws
        if np.any(np.isin(self.file.annotated[frame, ..., self.feature], new_label)):
            self.add_cell_info(add_label=new_label, frame=frame)

    def action_threshold(self, y1, x1, y2, x2, frame, label):
        """Threshold the raw image for annotation prediction within the
        user-determined bounding box.
        """
        top_edge = min(y1, y2)
        bottom_edge = max(y1, y2)
        left_edge = min(x1, x2)
        right_edge = max(x1, x2)

        # pull out the selection portion of the raw frame
        predict_area = self.file.raw[frame, top_edge:bottom_edge,
                                left_edge:right_edge, self.channel]

        # triangle threshold picked after trying a few on one dataset
        # may not be the best threshold approach for other datasets!
        # pick two thresholds to use hysteresis thresholding strategy
        threshold = filters.threshold_triangle(image=predict_area)
        threshold_stringent = 1.10 * threshold

        # try to keep stray pixels from appearing
        hyst = filters.apply_hysteresis_threshold(image=predict_area,
                                                  low=threshold,
                                                  high=threshold_stringent)
        ann_threshold = np.where(hyst, label, 0)

        # put prediction in without overwriting
        predict_area = self.file.annotated[frame, top_edge:bottom_edge,
                                      left_edge:right_edge, self.feature]
        safe_overlay = np.where(predict_area == 0, ann_threshold, predict_area)

        self.file.annotated[frame, top_edge:bottom_edge,
                       left_edge:right_edge, self.feature] = safe_overlay

        # don't need to update cell_info unless an annotation has been added
        if np.any(np.isin(self.file.annotated[frame, ..., self.feature], label)):
            self.add_cell_info(add_label=label, frame=frame)


class ZStackReview(BaseReview):

    def __init__(self, filename, input_bucket, output_bucket, path, rgb=False):
        super(ZStackReview, self).__init__(
            filename, input_bucket, output_bucket, path,
            raw_key='raw', annotated_key='annotated')

        self.file = ZStackFile(filename, input_bucket, path, 'raw', 'annotated', rgb)
        self.view = ZStackView(self.file)
        
        for feature in range(self.file.feature_max):
            self.create_cell_info(feature)

    @property
    def readable_tracks(self):
        """
        Preprocesses tracks for presentation on browser. For example,
        simplifying track['frames'] into something like [0-29] instead of
        [0,1,2,3,...].
        """
        cell_info = copy.deepcopy(self.file.cell_info)
        for _, feature in cell_info.items():
            for _, label in feature.items():
                slices = list(map(list, consecutive(label['frames'])))
                slices = '[' + ', '.join(["{}".format(a[0])
                                          if len(a) == 1 else "{}-{}".format(a[0], a[-1])
                                          for a in slices]) + ']'
                label['slices'] = str(slices)

        return cell_info

    def action_new_cell_stack(self, label, frame):
        """
        Creates new cell label and replaces original label with it in all subsequent frames
        """
        old_label, start_frame = label, frame
        new_label = self.view.get_max_label() + 1

        # replace frame labels
        for frame in self.file.annotated[start_frame:, ..., self.feature]:
            frame[frame == old_label] = new_label

        for frame in range(self.file.max_frames):
            if new_label in self.file.annotated[frame, ..., self.feature]:
                self.del_cell_info(del_label=old_label, frame=frame)
                self.add_cell_info(add_label=new_label, frame=frame)

    def action_replace_single(self, label_1, label_2, frame):
        '''
        replaces label_2 with label_1, but only in one frame. Frontend checks
        to make sure labels are different and were selected within same frames
        before sending action
        '''
        annotated = self.file.annotated[frame, ..., self.feature]
        # change annotation
        annotated = np.where(annotated == label_2, label_1, annotated)
        self.file.annotated[frame, ..., self.feature] = annotated
        # update info
        self.add_cell_info(add_label=label_1, frame=frame)
        self.del_cell_info(del_label=label_2, frame=frame)

    def action_replace(self, label_1, label_2):
        """
        Replacing label_2 with label_1. Frontend checks to make sure these labels
        are different before sending action
        """
        # check each frame
        for frame in range(self.file.max_frames):
            annotated = self.file.annotated[frame, ..., self.feature]
            # if label being replaced is present, remove it from image and update cell info dict
            if np.any(np.isin(annotated, label_2)):
                annotated = np.where(annotated == label_2, label_1, annotated)
                self.file.annotated[frame, ..., self.feature] = annotated
                self.add_cell_info(add_label=label_1, frame=frame)
                self.del_cell_info(del_label=label_2, frame=frame)

    def action_swap_all_frame(self, label_1, label_2):

        for frame in range(self.file.annotated.shape[0]):
            ann_img = self.file.annotated[frame, ..., self.feature]
            ann_img = np.where(ann_img == label_1, -1, ann_img)
            ann_img = np.where(ann_img == label_2, label_1, ann_img)
            ann_img = np.where(ann_img == -1, label_2, ann_img)
            self.file.annotated[frame, ..., self.feature] = ann_img

        # update cell_info
        cell_info_1 = self.file.cell_info[self.feature][label_1].copy()
        cell_info_2 = self.file.cell_info[self.feature][label_2].copy()
        self.file.cell_info[self.feature][label_1]['frames'] = cell_info_2['frames']
        self.file.cell_info[self.feature][label_2]['frames'] = cell_info_1['frames']

        self._y_changed = self.info_changed = True

    def action_predict_single(self, frame):
        '''
        predicts zstack relationship for current frame based on previous frame
        useful for finetuning corrections one frame at a time
        '''
        current_slice = frame
        if current_slice > 0:
            prev_slice = current_slice - 1
            img = self.file.annotated[prev_slice, ..., self.feature]
            next_img = self.file.annotated[current_slice, ..., self.feature]
            updated_slice = predict_zstack_cell_ids(img, next_img)

            # check if image changed
            comparison = np.where(next_img != updated_slice)
            self._y_changed = np.any(comparison)

            # if the image changed, update self.file.annotated and remake cell info
            if self._y_changed:
                self.file.annotated[current_slice, ..., self.feature] = updated_slice
                self.create_cell_info(feature=self.feature)

    def action_predict_zstack(self):
        '''
        use location of cells in image to predict which annotations are
        different slices of the same cell
        '''
        for zslice in range(self.file.annotated.shape[0] - 1):
            img = self.file.annotated[zslice, ..., self.feature]
            next_img = self.file.annotated[zslice + 1, ..., self.feature]
            predicted_next = predict_zstack_cell_ids(img, next_img)
            self.file.annotated[zslice + 1, ..., self.feature] = predicted_next

        # remake cell_info dict based on new annotations
        self._y_changed = True
        self.create_cell_info(feature=self.feature)

    def action_save_zstack(self):
        # save file to BytesIO object
        store_npz = io.BytesIO()

        # X and y are array names by convention
        np.savez(store_npz, X=self.file.raw, y=self.file.annotated)
        store_npz.seek(0)

        # store npz file object in bucket/path
        s3 = self.file._get_s3_client()
        s3.upload_fileobj(store_npz, self.output_bucket, self.file.path)

    def add_cell_info(self, add_label, frame):
        """Add a cell to the npz"""
        # if cell already exists elsewhere in npz:
        add_label = int(add_label)

        try:
            old_frames = self.file.cell_info[self.feature][add_label]['frames']
            updated_frames = np.append(old_frames, frame)
            updated_frames = np.unique(updated_frames).tolist()
            self.file.cell_info[self.feature][add_label]['frames'] = updated_frames
        # cell does not exist anywhere in npz:
        except KeyError:
            self.file.cell_info[self.feature][add_label] = {
                'label': str(add_label),
                'frames': [frame],
                'slices': ''
            }
            self.file.cell_ids[self.feature] = np.append(self.file.cell_ids[self.feature], add_label)

        # if adding cell, frames and info have necessarily changed
        self._y_changed = self.info_changed = True

    def del_cell_info(self, del_label, frame):
        """Remove a cell from the npz"""
        # remove cell from frame
        old_frames = self.file.cell_info[self.feature][del_label]['frames']
        updated_frames = np.delete(old_frames, np.where(old_frames == np.int64(frame))).tolist()
        self.file.cell_info[self.feature][del_label]['frames'] = updated_frames

        # if that was the last frame, delete the entry for that cell
        if self.file.cell_info[self.feature][del_label]['frames'] == []:
            del self.file.cell_info[self.feature][del_label]

            # also remove from list of cell_ids
            ids = self.file.cell_ids[self.feature]
            self.file.cell_ids[self.feature] = np.delete(ids, np.where(ids == np.int64(del_label)))

        # if deleting cell, frames and info have necessarily changed
        self._y_changed = self.info_changed = True

    def create_cell_info(self, feature):
        """Make or remake the entire cell info dict"""
        feature = int(feature)
        annotated = self.file.annotated[..., feature]

        self.file.cell_ids[feature] = np.unique(annotated)[np.nonzero(np.unique(annotated))]

        self.file.cell_info[feature] = {}

        for cell in self.file.cell_ids[feature]:
            cell = int(cell)

            self.file.cell_info[feature][cell] = {}
            self.file.cell_info[feature][cell]['label'] = str(cell)
            self.file.cell_info[feature][cell]['frames'] = []

            for frame in range(self.file.annotated.shape[0]):
                if cell in annotated[frame, ...]:
                    self.file.cell_info[feature][cell]['frames'].append(int(frame))
            self.file.cell_info[feature][cell]['slices'] = ''

        self.info_changed = True


class TrackReview(BaseReview):
    def __init__(self, filename, input_bucket, output_bucket, path):
        super(TrackReview, self).__init__(
            filename, input_bucket, output_bucket, path,
            raw_key='raw', annotated_key='tracked')

        self.file = TrackFile(filename, input_bucket, path)
        self.view = TrackView(self.file)

        self.view.scale_factor = 2

    @property
    def readable_tracks(self):
        """
        Preprocesses tracks for presentation on browser. For example,
        simplifying track['frames'] into something like [0-29] instead of
        [0,1,2,3,...].
        """
        tracks = copy.deepcopy(self.file.tracks)
        for _, track in tracks.items():
            frames = list(map(list, consecutive(track["frames"])))
            frames = '[' + ', '.join(["{}".format(a[0])
                                      if len(a) == 1 else "{}-{}".format(a[0], a[-1])
                                      for a in frames]) + ']'
            track['frames'] = frames

        return tracks

    def action_new_track(self, label, frame):
        """
        Replacing label - create in all subsequent frames
        """
        old_label, start_frame = label, frame
        new_label = self.view.get_max_label() + 1

        if start_frame != 0:
            # replace frame labels
            # TODO: which frame is this meant to be?
            for frame in self.file.annotated[start_frame:]:
                frame[frame == old_label] = new_label

            # replace fields
            track_old = self.file.tracks[old_label]
            track_new = self.file.tracks[new_label] = {}

            idx = track_old['frames'].index(start_frame)

            frames_before = track_old['frames'][:idx]
            frames_after = track_old['frames'][idx:]

            track_old['frames'] = frames_before
            track_new['frames'] = frames_after
            track_new['label'] = new_label

            # only add daughters if they aren't in the same frame as the new track
            track_new['daughters'] = []
            for d in track_old['daughters']:
                if start_frame not in self.file.tracks[d]['frames']:
                    track_new['daughters'].append(d)

            track_new['frame_div'] = track_old['frame_div']
            track_new['capped'] = track_old['capped']
            track_new['parent'] = None

            track_old['daughters'] = []
            track_old['frame_div'] = None
            track_old['capped'] = True

            self._y_changed = self.info_changed = True

    def action_set_parent(self, label_1, label_2):
        """
        label_1 gave birth to label_2
        """
        track_1 = self.file.tracks[label_1]
        track_2 = self.file.tracks[label_2]

        last_frame_parent = max(track_1['frames'])
        first_frame_daughter = min(track_2['frames'])

        if last_frame_parent < first_frame_daughter:
            track_1['daughters'].append(label_2)
            daughters = np.unique(track_1['daughters']).tolist()
            track_1['daughters'] = daughters

            track_2['parent'] = label_1

            if track_1['frame_div'] is None:
                track_1['frame_div'] = first_frame_daughter
            else:
                track_1['frame_div'] = min(track_1['frame_div'], first_frame_daughter)

            self.info_changed = True

    def action_replace(self, label_1, label_2):
        """
        Replacing label_2 with label_1
        """
        # replace arrays
        for frame in range(self.file.max_frames):
            annotated = self.file.annotated[frame]
            annotated = np.where(annotated == label_2, label_1, annotated)
            self.file.annotated[frame] = annotated

        # TODO: is this the same as add/remove?
        # replace fields
        track_1 = self.file.tracks[label_1]
        track_2 = self.file.tracks[label_2]

        for d in track_1['daughters']:
            self.file.tracks[d]['parent'] = None

        track_1['frames'].extend(track_2['frames'])
        track_1['frames'] = sorted(set(track_1['frames']))
        track_1['daughters'] = track_2['daughters']
        track_1['frame_div'] = track_2['frame_div']
        track_1['capped'] = track_2['capped']

        del self.file.tracks[label_2]
        for _, track in self.file.tracks.items():
            try:
                track['daughters'].remove(label_2)
            except ValueError:
                pass

        self._y_changed = self.info_changed = True

    def action_swap_tracks(self, label_1, label_2):
        def relabel(old_label, new_label):
            for frame in self.file.annotated:
                frame[frame == old_label] = new_label

            # replace fields
            track_new = self.file.tracks[new_label] = self.file.tracks[old_label]
            track_new['label'] = new_label
            del self.file.tracks[old_label]

            for d in track_new['daughters']:
                self.file.tracks[d]['parent'] = new_label

            if track_new['parent'] is not None:
                parent_track = self.file.tracks[track_new['parent']]
                parent_track['daughters'].remove(old_label)
                parent_track['daughters'].append(new_label)

        relabel(label_1, -1)
        relabel(label_2, label_1)
        relabel(-1, label_2)

        self._y_changed = self.info_changed = True

    def action_save_track(self):
        # clear any empty tracks before saving file
        empty_tracks = []
        for key in self.file.tracks:
            if not self.file.tracks[key]['frames']:
                empty_tracks.append(self.file.tracks[key]['label'])
        for track in empty_tracks:
            del self.file.tracks[track]

        # create file object in memory instead of writing to disk
        trk_file_obj = io.BytesIO()

        with tarfile.open(fileobj=trk_file_obj, mode='w') as trks:
            with tempfile.NamedTemporaryFile('w') as lineage_file:
                json.dump(self.file.tracks, lineage_file, indent=1)
                lineage_file.flush()
                trks.add(lineage_file.name, 'lineage.json')

            with tempfile.NamedTemporaryFile() as raw_file:
                np.save(raw_file, self.file.raw)
                raw_file.flush()
                trks.add(raw_file.name, 'raw.npy')

            with tempfile.NamedTemporaryFile() as tracked_file:
                np.save(tracked_file, self.file.annotated)
                tracked_file.flush()
                trks.add(tracked_file.name, 'tracked.npy')
        try:
            # go to beginning of file object
            trk_file_obj.seek(0)
            s3 = self.file._get_s3_client()
            s3.upload_fileobj(trk_file_obj, self.output_bucket, self.file.path)

        except Exception as e:
            print('Something Happened: ', e, file=sys.stderr)
            raise

    def add_cell_info(self, add_label, frame):
        """Add a cell to the trk"""
        # if cell already exists elsewhere in trk:
        add_label = int(add_label)
        try:
            old_frames = self.file.tracks[add_label]['frames']
            updated_frames = np.append(old_frames, frame)
            updated_frames = np.unique(updated_frames).tolist()
            self.file.tracks[add_label]['frames'] = updated_frames
        # cell does not exist anywhere in trk:
        except KeyError:
            self.file.tracks[add_label] = {
                'label': int(add_label),
                'frames': [frame],
                'daughters': [],
                'frame_div': None,
                'parent': None,
                'capped': False,
            }

        self._y_changed = self.info_changed = True

    def del_cell_info(self, del_label, frame):
        """Remove a cell from the trk"""
        # remove cell from frame
        old_frames = self.file.tracks[del_label]['frames']
        updated_frames = np.delete(old_frames, np.where(old_frames == np.int64(frame))).tolist()
        self.file.tracks[del_label]['frames'] = updated_frames

        # if that was the last frame, delete the entry for that cell
        if self.file.tracks[del_label]['frames'] == []:
            del self.file.tracks[del_label]

            # If deleting lineage data, remove parent/daughter entries
            for _, track in self.file.tracks.items():
                try:
                    track['daughters'].remove(del_label)
                except ValueError:
                    pass
                if track['parent'] == del_label:
                    track['parent'] = None

        self._y_changed = self.info_changed = True


def consecutive(data, stepsize=1):
    return np.split(data, np.where(np.diff(data) != stepsize)[0] + 1)


def predict_zstack_cell_ids(img, next_img, threshold=0.1):
    '''
    Predict labels for next_img based on intersection over union (iou)
    with img. If cells don't meet threshold for iou, they don't count as
    matching enough to share label with "matching" cell in img. Cells
    that don't have a match in img (new cells) get a new label so that
    output relabeled_next does not skip label values (unless label values
    present in prior image need to be skipped to avoid conflating labels).
    '''

    # relabel to remove skipped values, keeps subsequent predictions cleaner
    next_img = relabel_frame(next_img)

    # create np array that can hold all pairings between cells in one
    # image and cells in next image
    iou = np.zeros((np.max(img) + 1, np.max(next_img) + 1))

    vals = np.unique(img)
    cells = vals[np.nonzero(vals)]

    # nothing to predict off of
    if len(cells) == 0:
        return next_img

    next_vals = np.unique(next_img)
    next_cells = next_vals[np.nonzero(next_vals)]

    # no values to reassign
    if len(next_cells) == 0:
        return next_img

    # calculate IOUs
    for i in cells:
        for j in next_cells:
            intersection = np.logical_and(img == i, next_img == j)
            union = np.logical_or(img == i, next_img == j)
            iou[i, j] = intersection.sum(axis=(0, 1)) / union.sum(axis=(0, 1))

    # relabel cells appropriately

    # relabeled_next holds cells as they get relabeled appropriately
    relabeled_next = np.zeros(next_img.shape, dtype=np.uint16)

    # max_indices[cell_from_next_img] -> cell from first image that matches it best
    max_indices = np.argmax(iou, axis=0)

    # put cells that into new image if they've been matched with another cell

    # keep track of which (next_img)cells don't have matches
    # this can be if (next_img)cell matched background, or if (next_img)cell matched
    # a cell already used
    unmatched_cells = []
    # don't reuse cells (if multiple cells in next_img match one particular cell)
    used_cells_src = []

    # next_cell ranges between 0 and max(next_img)
    # matched_cell is which cell in img matched next_cell the best

    # this for loop does the matching between cells
    for next_cell, matched_cell in enumerate(max_indices):
        # if more than one match, look for best match
        # otherwise the first match gets linked together, not necessarily reproducible

        # matched_cell != 0 prevents adding the background to used_cells_src
        if matched_cell != 0 and matched_cell not in used_cells_src:
            bool_matches = np.where(max_indices == matched_cell)
            count_matches = np.count_nonzero(bool_matches)
            if count_matches > 1:
                # for a given cell in img, which next_cell has highest iou
                matching_next_options = np.argmax(iou, axis=1)
                best_matched_next = matching_next_options[matched_cell]

                # ignore if best_matched_next is the background
                if best_matched_next != 0:
                    if next_cell != best_matched_next:
                        unmatched_cells = np.append(unmatched_cells, next_cell)
                        continue
                    else:
                        # don't add if bad match
                        if iou[matched_cell][best_matched_next] > threshold:
                            relabeled_next = np.where(next_img == best_matched_next,
                                                      matched_cell, relabeled_next)

                        # if it's a bad match, we still need to add next_cell back
                        # into relabeled next later
                        elif iou[matched_cell][best_matched_next] <= threshold:
                            unmatched_cells = np.append(unmatched_cells, best_matched_next)

                        # in either case, we want to be done with the "matched_cell" from img
                        used_cells_src = np.append(used_cells_src, matched_cell)

            # matched_cell != 0 is still true
            elif count_matches == 1:
                # add the matched cell to the relabeled image
                if iou[matched_cell][next_cell] > threshold:
                    relabeled_next = np.where(next_img == next_cell, matched_cell, relabeled_next)
                else:
                    unmatched_cells = np.append(unmatched_cells, next_cell)

                used_cells_src = np.append(used_cells_src, matched_cell)

        elif matched_cell in used_cells_src and next_cell != 0:
            # skip that pairing, add next_cell to unmatched_cells
            unmatched_cells = np.append(unmatched_cells, next_cell)

        # if the cell in next_img didn't match anything (and is not the background):
        if matched_cell == 0 and next_cell != 0:
            unmatched_cells = np.append(unmatched_cells, next_cell)
            # note: this also puts skipped (nonexistent) labels into unmatched cells,
            # main reason to relabel first

    # figure out which labels we should use to label remaining, unmatched cells

    # these are the values that have already been used in relabeled_next
    relabeled_values = np.unique(relabeled_next)[np.nonzero(np.unique(relabeled_next))]

    # to account for any new cells that appear, create labels by adding to the max number of cells
    # assumes that these are new cells and that all prev labels have been assigned
    # only make as many new labels as needed

    current_max = max(np.max(cells), np.max(relabeled_values)) + 1

    stringent_allowed = []
    for additional_needed in range(len(unmatched_cells)):
        stringent_allowed.append(current_max)
        current_max += 1

    # replace each unmatched cell with a value from the stringent_allowed list,
    # add that relabeled cell to relabeled_next
    if len(unmatched_cells) > 0:
        for reassigned_cell in range(len(unmatched_cells)):
            relabeled_next = np.where(next_img == unmatched_cells[reassigned_cell],
                                      stringent_allowed[reassigned_cell], relabeled_next)

    return relabeled_next


def relabel_frame(img, start_val=1):
    '''relabel cells in frame starting from 1 without skipping values'''

    # cells in image to be relabeled
    cell_list = np.unique(img)
    cell_list = cell_list[np.nonzero(cell_list)]

    relabeled_cell_list = range(start_val, len(cell_list) + start_val)

    relabeled_img = np.zeros(img.shape, dtype=np.uint16)
    for i, cell in enumerate(cell_list):
        relabeled_img = np.where(img == cell, relabeled_cell_list[i], relabeled_img)

    return relabeled_img


def load_npz(filename):

    data = io.BytesIO(filename)
    npz = np.load(data)

    # standard nomenclature for image (X) and annotation (y)
    if 'y' in npz.files:
        raw_stack = npz['X']
        annotation_stack = npz['y']

    # some files may have alternate names 'raw' and 'annotated'
    elif 'raw' in npz.files:
        raw_stack = npz['raw']
        annotation_stack = npz['annotated']

    # if files are named something different, give it a try anyway
    else:
        raw_stack = npz[npz.files[0]]
        annotation_stack = npz[npz.files[1]]

    return {'raw': raw_stack, 'annotated': annotation_stack}


# copied from:
# vanvalenlab/deepcell-tf/blob/master/deepcell/utils/tracking_utils.py3

def load_trks(trkfile):
    """Load a trk/trks file.
    Args:
        trks_file: full path to the file including .trk/.trks
    Returns:
        A dictionary with raw, tracked, and lineage data
    """
    with tempfile.NamedTemporaryFile() as temp:
        temp.write(trkfile)
        with tarfile.open(temp.name, 'r') as trks:

            # numpy can't read these from disk...
            array_file = io.BytesIO()
            array_file.write(trks.extractfile('raw.npy').read())
            array_file.seek(0)
            raw = np.load(array_file)
            array_file.close()

            array_file = io.BytesIO()
            array_file.write(trks.extractfile('tracked.npy').read())
            array_file.seek(0)
            tracked = np.load(array_file)
            array_file.close()

            try:
                trk_data = trks.getmember('lineages.json')
            except KeyError:
                try:
                    trk_data = trks.getmember('lineage.json')
                except KeyError:
                    raise ValueError('Invalid .trk file, no lineage data found.')

            lineages = json.loads(trks.extractfile(trk_data).read().decode())
            lineages = lineages if isinstance(lineages, list) else [lineages]

            # JSON only allows strings as keys, so convert them back to ints
            for i, tracks in enumerate(lineages):
                lineages[i] = {int(k): v for k, v in tracks.items()}

        return {'lineages': lineages, 'raw': raw, 'tracked': tracked}
